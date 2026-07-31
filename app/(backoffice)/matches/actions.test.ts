import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    match: { findUnique: vi.fn(), update: vi.fn() },
    delivery: { findFirst: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

import { updateMatchStatus } from './actions'
import { requireAgente } from '@/lib/auth'

const baseMatch = {
  status: 'SUGERIDO' as const,
  vehicleId: 'veh-1',
  buyerLeadId: 'buyer-1',
  vehicle: { sellerLeadId: 'seller-1' },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue({ id: 'agent-1' } as never)
  mockDb.match.update.mockResolvedValue({})
  mockDb.activity.create.mockResolvedValue({})
  mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
    fn(mockDb)
  )
})

describe('updateMatchStatus', () => {
  it('devuelve error si el match no existe', async () => {
    mockDb.match.findUnique.mockResolvedValue(null)
    const res = await updateMatchStatus('nope', 'PROPUESTO_CLIENTE')
    expect(res).toEqual({ error: 'Match no encontrado' })
    expect(mockDb.match.update).not.toHaveBeenCalled()
  })

  it('permite un salto no secuencial (SUGERIDO → VISITA) y deja traza en ambos leads', async () => {
    mockDb.match.findUnique.mockResolvedValue({ ...baseMatch })
    const res = await updateMatchStatus('m1', 'VISITA')
    expect(res).toEqual({ ok: true })
    expect(mockDb.match.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { status: 'VISITA' },
    })
    expect(mockDb.activity.create).toHaveBeenCalledTimes(2)
    expect(mockDb.activity.create.mock.calls.map((call) => call[0].data)).toEqual([
      expect.objectContaining({ sellerLeadId: 'seller-1', type: 'CAMBIO_ESTADO' }),
      expect.objectContaining({ buyerLeadId: 'buyer-1', type: 'CAMBIO_ESTADO' }),
    ])
  })

  it('permite RECHAZADO desde un estado activo', async () => {
    mockDb.match.findUnique.mockResolvedValue({ ...baseMatch, status: 'VISITA' })
    const res = await updateMatchStatus('m1', 'RECHAZADO')
    expect(res).toEqual({ ok: true })
  })

  it('mantiene el guard de Delivery al saltar SUGERIDO → CERRADO', async () => {
    mockDb.match.findUnique.mockResolvedValue({ ...baseMatch })
    mockDb.delivery.findFirst.mockResolvedValue(null)
    const res = await updateMatchStatus('m1', 'CERRADO')
    expect(res.error).toContain('entrega completada')
    expect(mockDb.match.update).not.toHaveBeenCalled()
  })

  it('permite corregir un match CERRADO a RECHAZADO', async () => {
    mockDb.match.findUnique.mockResolvedValue({ ...baseMatch, status: 'CERRADO' })
    const res = await updateMatchStatus('m1', 'RECHAZADO')
    expect(res).toEqual({ ok: true })
    expect(mockDb.match.update).toHaveBeenCalled()
  })

  it('no permite CERRAR sin una entrega completada', async () => {
    mockDb.match.findUnique.mockResolvedValue({ ...baseMatch, status: 'SUGERIDO' })
    mockDb.delivery.findFirst.mockResolvedValue(null)
    const res = await updateMatchStatus('m1', 'CERRADO')
    expect(res.error).toContain('entrega completada')
    expect(mockDb.match.update).not.toHaveBeenCalled()
  })

  it('cierra el match si existe entrega completada', async () => {
    mockDb.match.findUnique.mockResolvedValue({ ...baseMatch, status: 'SUGERIDO' })
    mockDb.delivery.findFirst.mockResolvedValue({ id: 'del-1' })
    const res = await updateMatchStatus('m1', 'CERRADO')
    expect(res).toEqual({ ok: true })
    expect(mockDb.match.update).toHaveBeenCalled()
  })
})
