import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    match: { findUnique: vi.fn(), update: vi.fn() },
    delivery: { findFirst: vi.fn() },
  }
  return { mockDb }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

import { updateMatchStatus } from './actions'

const baseMatch = {
  status: 'SUGERIDO' as const,
  vehicleId: 'veh-1',
  buyerLeadId: 'buyer-1',
  vehicle: { sellerLeadId: 'seller-1' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.match.update.mockResolvedValue({})
})

describe('updateMatchStatus', () => {
  it('devuelve error si el match no existe', async () => {
    mockDb.match.findUnique.mockResolvedValue(null)
    const res = await updateMatchStatus('nope', 'PROPUESTO_CLIENTE')
    expect(res).toEqual({ error: 'Match no encontrado' })
    expect(mockDb.match.update).not.toHaveBeenCalled()
  })

  it('permite una transición válida (SUGERIDO → PROPUESTO_CLIENTE)', async () => {
    mockDb.match.findUnique.mockResolvedValue({ ...baseMatch })
    const res = await updateMatchStatus('m1', 'PROPUESTO_CLIENTE')
    expect(res).toEqual({ ok: true })
    expect(mockDb.match.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { status: 'PROPUESTO_CLIENTE' },
    })
  })

  it('permite RECHAZADO desde un estado activo', async () => {
    mockDb.match.findUnique.mockResolvedValue({ ...baseMatch, status: 'VISITA' })
    const res = await updateMatchStatus('m1', 'RECHAZADO')
    expect(res).toEqual({ ok: true })
  })

  it('rechaza una transición inválida (SUGERIDO → CERRADO)', async () => {
    mockDb.match.findUnique.mockResolvedValue({ ...baseMatch })
    const res = await updateMatchStatus('m1', 'CERRADO')
    expect(res.error).toContain('Transición inválida')
    expect(mockDb.match.update).not.toHaveBeenCalled()
  })

  it('rechaza salir de un estado terminal (CERRADO no tiene transiciones)', async () => {
    mockDb.match.findUnique.mockResolvedValue({ ...baseMatch, status: 'CERRADO' })
    const res = await updateMatchStatus('m1', 'RECHAZADO')
    expect(res.error).toContain('Transición inválida')
    expect(mockDb.match.update).not.toHaveBeenCalled()
  })

  it('no permite CERRAR sin una entrega completada', async () => {
    mockDb.match.findUnique.mockResolvedValue({ ...baseMatch, status: 'OFERTA' })
    mockDb.delivery.findFirst.mockResolvedValue(null)
    const res = await updateMatchStatus('m1', 'CERRADO')
    expect(res.error).toContain('entrega completada')
    expect(mockDb.match.update).not.toHaveBeenCalled()
  })

  it('cierra el match si existe entrega completada', async () => {
    mockDb.match.findUnique.mockResolvedValue({ ...baseMatch, status: 'OFERTA' })
    mockDb.delivery.findFirst.mockResolvedValue({ id: 'del-1' })
    const res = await updateMatchStatus('m1', 'CERRADO')
    expect(res).toEqual({ ok: true })
    expect(mockDb.match.update).toHaveBeenCalled()
  })
})
