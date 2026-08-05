import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
  requireCanViewPostventa: vi.fn(),
  requireCanEditPostventa: vi.fn(),
}))
vi.mock('@/lib/postventa', () => ({
  extendWarranty: vi.fn(),
}))
vi.mock('@/lib/locking', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/locking')>()
  return { ...actual, withLockedRoots: vi.fn() }
})
vi.mock('@/lib/email/send', () => ({
  sendTicketOpenedNotification: vi.fn(() => Promise.resolve()),
}))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    warranty: { findUnique: vi.fn() },
    postventaTicket: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    postventaTicketPhoto: { create: vi.fn() },
    vehicleCost: { upsert: vi.fn(), deleteMany: vi.fn() },
    user: { findMany: vi.fn() },
    activity: { create: vi.fn() },
  }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireAdmin, requireCanViewPostventa, requireCanEditPostventa } from '@/lib/auth'
import { extendWarranty as extendWarrantyLib } from '@/lib/postventa'
import { withLockedRoots } from '@/lib/locking'
import { sendTicketOpenedNotification } from '@/lib/email/send'
import {
  changeTicketStatus,
  createTicket,
  extendWarranty,
  setTicketCost,
  updateTicket,
  uploadTicketPhoto,
  reopenTicket,
} from './actions'

const actor = { id: 'user-1', name: 'Manolo', role: 'ENTREGAS' } as User
const admin = { id: 'admin-1', name: 'Joel', role: 'ADMIN' } as User

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCanViewPostventa).mockResolvedValue(actor)
  vi.mocked(requireCanEditPostventa).mockResolvedValue(actor)
  vi.mocked(requireAdmin).mockResolvedValue(admin)
  mockDb.postventaTicket.create.mockResolvedValue({ id: 'tkt-1' })
  mockDb.postventaTicket.update.mockResolvedValue({})
  mockDb.postventaTicket.updateMany.mockResolvedValue({ count: 1 })
  mockDb.vehicleCost.upsert.mockResolvedValue({})
  mockDb.vehicleCost.deleteMany.mockResolvedValue({ count: 0 })
  mockDb.activity.create.mockResolvedValue({})
  vi.mocked(withLockedRoots).mockImplementation(async (_roots, operation) =>
    operation(mockDb as never)
  )
})

describe('createTicket', () => {
  const valid = {
    warrantyId: 'war-1',
    title: 'Fuga en el boiler',
    description: 'Gotea al calentar',
    priority: 'MEDIA' as const,
  }

  it('rechaza datos inválidos', async () => {
    const res = await createTicket({ ...valid, title: '' })
    expect(res.ok).toBe(false)
  })

  it('error si la garantía no existe', async () => {
    mockDb.warranty.findUnique.mockResolvedValue(null)
    const res = await createTicket(valid)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('Garantía no encontrada')
  })

  it('crea ticket + actividad; no notifica en prioridad MEDIA', async () => {
    mockDb.warranty.findUnique.mockResolvedValue({ vehicleId: 'v1', buyerLeadId: 'b1' })
    const res = await createTicket(valid)
    expect(res).toEqual({ ok: true, data: { id: 'tkt-1' } })
    expect(mockDb.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'TICKET_POSTVENTA_ABIERTO' }),
      })
    )
    expect(sendTicketOpenedNotification).not.toHaveBeenCalled()
  })

  it('notifica a admins en prioridad CRITICA', async () => {
    mockDb.warranty.findUnique.mockResolvedValue({ vehicleId: 'v1', buyerLeadId: 'b1' })
    mockDb.user.findMany.mockResolvedValue([{ email: 'joel@cn.com' }])
    const res = await createTicket({ ...valid, priority: 'CRITICA' })
    expect(res.ok).toBe(true)
    expect(sendTicketOpenedNotification).toHaveBeenCalled()
  })
})

describe('changeTicketStatus', () => {
  it('error si el ticket no existe', async () => {
    mockDb.postventaTicket.findUnique.mockResolvedValue(null)
    const res = await changeTicketStatus('x', 'EN_PROGRESO')
    expect(res.ok).toBe(false)
  })

  it('rechaza transición inválida (ABIERTO → CERRADO)', async () => {
    mockDb.postventaTicket.findUnique.mockResolvedValue({
      status: 'ABIERTO',
      warrantyId: 'w1',
      title: 'Fuga',
      costReal: null,
      resolvedAt: null,
      cost: null,
      warranty: { id: 'w1', buyerLeadId: 'b1', vehicleId: 'v1', vehicle: { sellerLeadId: 's1' } },
    })
    const res = await changeTicketStatus('t1', 'CERRADO')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('no está permitida')
    expect(mockDb.vehicleCost.upsert).not.toHaveBeenCalled()
  })

  it('transición válida ABIERTO → EN_PROGRESO', async () => {
    mockDb.postventaTicket.findUnique.mockResolvedValue({
      status: 'ABIERTO',
      warrantyId: 'w1',
      title: 'Fuga',
      costReal: null,
      resolvedAt: null,
      cost: null,
      warranty: { id: 'w1', buyerLeadId: 'b1', vehicleId: 'v1', vehicle: { sellerLeadId: 's1' } },
    })
    const res = await changeTicketStatus('t1', 'EN_PROGRESO')
    expect(res).toEqual({ ok: true })
    expect(mockDb.postventaTicket.updateMany).toHaveBeenCalled()
  })

  it('al CERRAR imputa el coste al vehículo', async () => {
    mockDb.postventaTicket.findUnique.mockResolvedValue({
      status: 'RESUELTO',
      warrantyId: 'w1',
      title: 'Fuga',
      costReal: 150,
      resolvedAt: new Date(),
      cost: null,
      warranty: { id: 'w1', buyerLeadId: 'b1', vehicleId: 'v1', vehicle: { sellerLeadId: 's1' } },
    })
    const res = await changeTicketStatus('t1', 'CERRADO')
    expect(res).toEqual({ ok: true })
    expect(mockDb.vehicleCost.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { postventaTicketId: 't1' } })
    )
  })

  it('exige motivo para corregir RESUELTO a EN_PROGRESO', async () => {
    mockDb.postventaTicket.findUnique.mockResolvedValue({
      status: 'RESUELTO',
      warrantyId: 'w1',
      title: 'Fuga',
      costReal: null,
      resolvedAt: new Date(),
      cost: null,
      warranty: { id: 'w1', buyerLeadId: 'b1', vehicleId: 'v1', vehicle: { sellerLeadId: 's1' } },
    })

    expect((await changeTicketStatus('t1', 'EN_PROGRESO')).ok).toBe(false)
    expect((await changeTicketStatus('t1', 'EN_PROGRESO', 'Resolución prematura')).ok).toBe(true)
  })

  it('reabre un cierre únicamente por la acción admin', async () => {
    mockDb.postventaTicket.findUnique.mockResolvedValue({
      status: 'CERRADO',
      warrantyId: 'w1',
      title: 'Fuga',
      costReal: 150,
      resolvedAt: new Date(),
      cost: { amount: 150 },
      warranty: { id: 'w1', buyerLeadId: 'b1', vehicleId: 'v1', vehicle: { sellerLeadId: 's1' } },
    })

    const result = await reopenTicket('t1', 'RESUELTO', 'Incidencia reproducida')
    expect(result.ok).toBe(true)
    expect(requireAdmin).toHaveBeenCalled()
    expect(mockDb.vehicleCost.upsert).not.toHaveBeenCalled()
  })
})

describe('extendWarranty', () => {
  it('error si la garantía no existe', async () => {
    mockDb.warranty.findUnique.mockResolvedValue(null)
    const res = await extendWarranty('w1', 12)
    expect(res.ok).toBe(false)
    expect(extendWarrantyLib).not.toHaveBeenCalled()
  })

  it('amplía la garantía y registra la actividad', async () => {
    mockDb.warranty.findUnique.mockResolvedValue({ buyerLeadId: 'b1' })
    const res = await extendWarranty('w1', 12)
    expect(res).toEqual({ ok: true })
    expect(extendWarrantyLib).toHaveBeenCalledWith('w1', 12, 'admin-1', mockDb)
    expect(mockDb.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'GARANTIA_AMPLIADA' }) })
    )
  })
})

describe('terminal write guards', () => {
  it('bloquea edición, costes y fotos cuando el ticket está cerrado', async () => {
    mockDb.postventaTicket.findUnique.mockResolvedValue({
      status: 'CERRADO',
      warrantyId: 'w1',
      warranty: { id: 'w1', buyerLeadId: 'b1', vehicleId: 'v1', vehicle: { sellerLeadId: 's1' } },
    })

    const results = await Promise.all([
      updateTicket('t1', { title: 'No debe cambiar' }),
      setTicketCost('t1', { costReal: 200 }),
      uploadTicketPhoto('t1', { type: 'SOLUCION', url: 'https://example.com/photo.jpg' }),
    ])

    expect(results.every((result) => !result.ok)).toBe(true)
    expect(mockDb.postventaTicket.update).not.toHaveBeenCalled()
    expect(mockDb.postventaTicketPhoto.create).not.toHaveBeenCalled()
  })
})
