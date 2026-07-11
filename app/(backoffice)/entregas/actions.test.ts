import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
  requireCanViewEntregas: vi.fn(),
  requireCanEditEntregas: vi.fn(),
}))
vi.mock('@/lib/email/send', () => ({ sendDeliveryConfirmation: vi.fn(() => Promise.resolve()) }))

// El servicio transaccional se mockea para controlar éxito/conflicto/error inesperado.
// DeliveryConflictError se mantiene REAL (importOriginal) para que instanceof funcione.
vi.mock('@/lib/delivery-completion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/delivery-completion')>()
  return { ...actual, completeDeliveryTx: vi.fn() }
})

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    delivery: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireCanEditEntregas } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { completeDeliveryTx, DeliveryConflictError } from '@/lib/delivery-completion'
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
  mockDb.activity.create.mockResolvedValue({})
  mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
    fn(mockDb)
  )
  vi.mocked(completeDeliveryTx).mockResolvedValue({ warrantyId: 'war-1' })
})

describe('updateDeliveryStatus · validaciones previas', () => {
  it('error si la entrega no existe', async () => {
    mockDb.delivery.findUnique.mockResolvedValue(null)
    const res = await updateDeliveryStatus('x', 'EN_CURSO')
    expect(res).toEqual({ ok: false, error: 'Entrega no encontrada' })
    expect(completeDeliveryTx).not.toHaveBeenCalled()
  })

  it('rechaza transición inválida (PROGRAMADA → COMPLETADA)', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete, status: 'PROGRAMADA' })
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('no permitida')
    expect(completeDeliveryTx).not.toHaveBeenCalled()
  })

  it('bloquea COMPLETADA si hay ítems de checklist pendientes', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({
      ...signedComplete,
      checklist: [{ result: 'OK' }, { result: 'PENDIENTE' }],
    })
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('pendientes')
    expect(completeDeliveryTx).not.toHaveBeenCalled()
  })

  it('bloquea COMPLETADA si falta la firma', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete, signedByName: null })
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('firma')
    expect(completeDeliveryTx).not.toHaveBeenCalled()
  })
})

describe('updateDeliveryStatus · finalización atómica (COMPLETADA)', () => {
  it('invoca el servicio transaccional con el contexto correcto y revalida tras el commit', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete })
    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res).toEqual({ ok: true })

    expect(completeDeliveryTx).toHaveBeenCalledOnce()
    const [, params] = vi.mocked(completeDeliveryTx).mock.calls[0]
    expect(params).toMatchObject({
      deliveryId: 'd1',
      vehicleId: 'veh-1',
      buyerLeadId: 'buyer-1',
      sellerLeadId: 'seller-1',
      actorId: 'user-1',
    })
    expect(params.now).toBeInstanceOf(Date)
    expect(revalidatePath).toHaveBeenCalledWith('/entregas')
    expect(revalidatePath).toHaveBeenCalledWith('/entregas/d1')
  })

  it('traduce DeliveryConflictError a { ok:false, error } y NO revalida', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete })
    vi.mocked(completeDeliveryTx).mockRejectedValue(new DeliveryConflictError('delivery'))

    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('ya no está disponible')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('traduce un conflicto de vehículo incompatible a { ok:false, error }', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete })
    vi.mocked(completeDeliveryTx).mockRejectedValue(new DeliveryConflictError('vehicle'))

    const res = await updateDeliveryStatus('d1', 'COMPLETADA')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('vehículo ya no está disponible')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('propaga un error técnico inesperado (no lo oculta como conflicto) y NO revalida', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete })
    vi.mocked(completeDeliveryTx).mockRejectedValue(new Error('DB caída'))

    await expect(updateDeliveryStatus('d1', 'COMPLETADA')).rejects.toThrow('DB caída')
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('updateDeliveryStatus · transiciones sin garantía (EN_CURSO / CANCELADA)', () => {
  it('EN_CURSO actualiza la entrega y no invoca el servicio de finalización', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete, status: 'PROGRAMADA' })
    const res = await updateDeliveryStatus('d1', 'EN_CURSO')
    expect(res).toEqual({ ok: true })
    expect(completeDeliveryTx).not.toHaveBeenCalled()
    expect(mockDb.delivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1' } })
    )
  })

  it('CANCELADA registra la actividad de cancelación sin garantía', async () => {
    mockDb.delivery.findUnique.mockResolvedValue({ ...signedComplete })
    const res = await updateDeliveryStatus('d1', 'CANCELADA')
    expect(res).toEqual({ ok: true })
    expect(completeDeliveryTx).not.toHaveBeenCalled()
    const types = mockDb.activity.create.mock.calls.map((c) => c[0].data.type)
    expect(types).toContain('ENTREGA_CANCELADA')
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
