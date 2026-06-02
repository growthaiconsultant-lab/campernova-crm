import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
  requireCanViewPostventa: vi.fn(),
  requireCanEditPostventa: vi.fn(),
}))
vi.mock('@/lib/postventa', () => ({
  imputeTicketCost: vi.fn(),
  extendWarranty: vi.fn(),
}))
vi.mock('@/lib/email/send', () => ({
  sendTicketOpenedNotification: vi.fn(() => Promise.resolve()),
}))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    warranty: { findUnique: vi.fn() },
    postventaTicket: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    user: { findMany: vi.fn() },
    activity: { create: vi.fn() },
  }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireAdmin, requireCanViewPostventa, requireCanEditPostventa } from '@/lib/auth'
import { imputeTicketCost, extendWarranty as extendWarrantyLib } from '@/lib/postventa'
import { sendTicketOpenedNotification } from '@/lib/email/send'
import { createTicket, changeTicketStatus, extendWarranty } from './actions'

const actor = { id: 'user-1', name: 'Manolo', role: 'ENTREGAS' } as User
const admin = { id: 'admin-1', name: 'Joel', role: 'ADMIN' } as User

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCanViewPostventa).mockResolvedValue(actor)
  vi.mocked(requireCanEditPostventa).mockResolvedValue(actor)
  vi.mocked(requireAdmin).mockResolvedValue(admin)
  mockDb.postventaTicket.create.mockResolvedValue({ id: 'tkt-1' })
  mockDb.postventaTicket.update.mockResolvedValue({})
  mockDb.activity.create.mockResolvedValue({})
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
      costReal: null,
      warranty: { buyerLeadId: 'b1' },
    })
    const res = await changeTicketStatus('t1', 'CERRADO')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('no permitida')
    expect(imputeTicketCost).not.toHaveBeenCalled()
  })

  it('transición válida ABIERTO → EN_PROGRESO', async () => {
    mockDb.postventaTicket.findUnique.mockResolvedValue({
      status: 'ABIERTO',
      costReal: null,
      warranty: { buyerLeadId: 'b1' },
    })
    const res = await changeTicketStatus('t1', 'EN_PROGRESO')
    expect(res).toEqual({ ok: true })
    expect(mockDb.postventaTicket.update).toHaveBeenCalled()
  })

  it('al CERRAR imputa el coste al vehículo', async () => {
    mockDb.postventaTicket.findUnique.mockResolvedValue({
      status: 'RESUELTO',
      costReal: 150,
      warranty: { buyerLeadId: 'b1' },
    })
    const res = await changeTicketStatus('t1', 'CERRADO')
    expect(res).toEqual({ ok: true })
    expect(imputeTicketCost).toHaveBeenCalledWith('t1', 'user-1', mockDb)
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
