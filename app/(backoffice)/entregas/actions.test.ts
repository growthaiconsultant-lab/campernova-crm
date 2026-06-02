import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
  requireCanViewEntregas: vi.fn(),
  requireCanEditEntregas: vi.fn(),
}))
vi.mock('@/lib/postventa', () => ({ createWarrantyForDelivery: vi.fn() }))
vi.mock('@/lib/email/send', () => ({ sendDeliveryConfirmation: vi.fn(() => Promise.resolve()) }))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    delivery: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    vehicle: { findUnique: vi.fn(), update: vi.fn() },
    buyerLead: { update: vi.fn() },
    match: { updateMany: vi.fn() },
    warranty: { findUnique: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireCanEditEntregas } from '@/lib/auth'
import { createWarrantyForDelivery } from '@/lib/postventa'
import { updateDeliveryStatus, signDelivery } from './actions'

const editor = { id: 'user-1', role: 'ENTREGAS' } as User
const admin = { id: 'admin-1', role: 'ADMIN' } as User

const signedComplete = {
  status: 'EN_CURSO' as const,
  vehicleId: 'veh-1',
  buyerLeadId: 'buyer-1',
  signedByName: 'Cliente',
  signedByDni: '12345678Z',
  signatureUrl: 'sig.png',
  vehicle: { sellerLeadId: 'seller-1' },
  checklist: [{ result: 'OK' }, { result: 'NO_APLICA' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCanEditEntregas).mockResolvedValue(editor)
  mockDb.delivery.update.mockResolvedValue({})
  mockDb.vehicle.update.mockResolvedValue({})
  mockDb.buyerLead.update.mockResolvedValue({})
  mockDb.match.updateMany.mockResolvedValue({})
  mockDb.activity.create.mockResolvedValue({})
  mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
    fn(mockDb)
  )
})

describe('updateDeliveryStatus', () => {
  it('error si la entrega no existe', async () => {
    mockDb.delivery.findUnique.mockResolvedValue(null)
    const res = await updateDeliveryStatus('x', 'EN_CURSO')
    expect(res).toEqual({ ok: false, error: 'Entrega no encontrada' })
  })

  it('rechaza transición inválida (PROGRAMADA → COMPLETADA)', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete, status: 'PROGRAMADA' })
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('no permitida')
  })

  it('bloquea COMPLETADA si hay ítems de checklist pendientes', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({
      ...signedComplete,
      checklist: [{ result: 'OK' }, { result: 'PENDIENTE' }],
    })
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('pendientes')
    expect(createWarrantyForDelivery).not.toHaveBeenCalled()
  })

  it('bloquea COMPLETADA si falta la firma', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete, signedByName: null })
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('firma')
  })

  it('completa la entrega: marca vehículo VENDIDO, cierra buyer y crea garantía', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete })
    mockDb.warranty.findUnique.mockResolvedValue({ id: 'war-1' })
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res).toEqual({ ok: true })
    expect(mockDb.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'VENDIDO' }) })
    )
    expect(mockDb.buyerLead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CERRADO' } })
    )
    expect(createWarrantyForDelivery).toHaveBeenCalledWith('d1', mockDb)
  })
})

describe('signDelivery', () => {
  const validSign = { signedByName: 'Cliente', signedByDni: '12345678Z', signatureUrl: 'sig.png' }

  it('rechaza datos de firma inválidos', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ status: 'EN_CURSO', responsableId: 'user-1' })
    const res = await signDelivery('d1', { signedByName: '', signedByDni: '', signatureUrl: '' })
    expect(res.ok).toBe(false)
  })

  it('no permite firmar una entrega ya cerrada', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ status: 'COMPLETADA', responsableId: 'user-1' })
    const res = await signDelivery('d1', validSign)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('cerrada')
  })

  it('bloquea a quien no es responsable ni admin', async () => {
    vi.mocked(requireCanEditEntregas).mockResolvedValue(editor) // user-1
    mockDb.delivery.findUnique.mockResolvedValue({ status: 'EN_CURSO', responsableId: 'otro' })
    const res = await signDelivery('d1', validSign)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('responsable')
  })

  it('permite al admin firmar cualquier entrega', async () => {
    vi.mocked(requireCanEditEntregas).mockResolvedValue(admin)
    mockDb.delivery.findUnique.mockResolvedValue({ status: 'EN_CURSO', responsableId: 'otro' })
    const res = await signDelivery('d1', validSign)
    expect(res).toEqual({ ok: true })
    expect(mockDb.delivery.update).toHaveBeenCalled()
  })
})
