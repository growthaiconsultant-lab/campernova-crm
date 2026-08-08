import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDb, mockWithLockedRoots } = vi.hoisted(() => {
  const mockDb = {
    vehicle: { findUnique: vi.fn(), findMany: vi.fn() },
    buyerLead: { findUnique: vi.fn(), findMany: vi.fn() },
    match: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    delivery: { findFirst: vi.fn() },
    activity: { create: vi.fn() },
  }
  const mockWithLockedRoots = vi.fn(
    async (_roots: unknown, fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb)
  )
  return { mockDb, mockWithLockedRoots }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/locking', () => ({
  withLockedRoots: mockWithLockedRoots,
  isLockError: () => false,
}))

import { createManualMatch, updateMatchStatus } from './actions'
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
  mockDb.match.updateMany.mockResolvedValue({ count: 1 })
  mockDb.activity.create.mockResolvedValue({})
})

function arrangeStatusMatch(status = 'SUGERIDO') {
  mockDb.match.findUnique
    .mockResolvedValueOnce({
      vehicleId: 'veh-1',
      buyerLeadId: 'buyer-1',
      vehicle: { sellerLeadId: 'seller-1' },
    })
    .mockResolvedValueOnce({ ...baseMatch, status })
}

describe('updateMatchStatus', () => {
  it('devuelve error si el match no existe', async () => {
    mockDb.match.findUnique.mockResolvedValue(null)
    const result = await updateMatchStatus('nope', 'PROPUESTO_CLIENTE')
    expect(result).toEqual({ error: 'Match no encontrado' })
    expect(mockWithLockedRoots).not.toHaveBeenCalled()
  })

  it('actualiza por CAS y deja una traza en cada timeline', async () => {
    arrangeStatusMatch()

    const result = await updateMatchStatus('match-1', 'VISITA')

    expect(result).toEqual({ ok: true })
    expect(mockDb.match.updateMany).toHaveBeenCalledWith({
      where: { id: 'match-1', status: 'SUGERIDO' },
      data: { status: 'VISITA' },
    })
    expect(mockDb.activity.create).toHaveBeenCalledTimes(2)
  })

  it('no duplica Activity al repetir el mismo estado', async () => {
    arrangeStatusMatch('VISITA')

    const result = await updateMatchStatus('match-1', 'VISITA')

    expect(result).toEqual({ ok: true })
    expect(mockDb.match.updateMany).not.toHaveBeenCalled()
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('exige una Delivery completada de la pareja exacta para cerrar', async () => {
    arrangeStatusMatch()
    mockDb.delivery.findFirst.mockResolvedValue(null)

    const result = await updateMatchStatus('match-1', 'CERRADO')

    expect(result.error).toContain('misma pareja')
    expect(mockDb.delivery.findFirst).toHaveBeenCalledWith({
      where: { vehicleId: 'veh-1', buyerLeadId: 'buyer-1', status: 'COMPLETADA' },
      select: { id: true },
    })
    expect(mockDb.match.updateMany).not.toHaveBeenCalled()
  })

  it('cierra cuando existe la Delivery completada de esa pareja', async () => {
    arrangeStatusMatch()
    mockDb.delivery.findFirst.mockResolvedValue({ id: 'delivery-1' })

    const result = await updateMatchStatus('match-1', 'CERRADO')

    expect(result).toEqual({ ok: true })
    expect(mockDb.match.updateMany).toHaveBeenCalled()
  })
})

describe('createManualMatch', () => {
  it('enforcea requireAgente antes de leer o mutar', async () => {
    vi.mocked(requireAgente).mockRejectedValueOnce(new Error('FORBIDDEN'))

    await expect(
      createManualMatch({
        vehicleId: 'veh-1',
        buyerLeadId: 'buyer-1',
        reason: 'OTRO',
      })
    ).rejects.toThrow('FORBIDDEN')
    expect(mockDb.vehicle.findUnique).not.toHaveBeenCalled()
    expect(mockWithLockedRoots).not.toHaveBeenCalled()
  })

  it('valida el payload antes de consultar el vehículo', async () => {
    const result = await createManualMatch({ vehicleId: '', buyerLeadId: 'b', reason: 'OTRO' })
    expect(result.ok).toBe(false)
    expect(mockDb.vehicle.findUnique).not.toHaveBeenCalled()
  })

  it('crea una relación manual bajo los tres root locks', async () => {
    mockDb.vehicle.findUnique
      .mockResolvedValueOnce({ sellerLeadId: 'seller-1' })
      .mockResolvedValueOnce({
        id: 'veh-1',
        sellerLeadId: 'seller-1',
        sellerLead: { archivedAt: null },
      })
    mockDb.buyerLead.findUnique.mockResolvedValue({ id: 'buyer-1', archivedAt: null })
    mockDb.match.findUnique.mockResolvedValue(null)
    mockDb.match.create.mockResolvedValue({ id: 'match-new' })

    const result = await createManualMatch({
      vehicleId: 'veh-1',
      buyerLeadId: 'buyer-1',
      reason: 'OTRO',
      notes: '',
    })

    expect(result).toEqual({
      ok: true,
      status: 'created',
      message: 'Relación vinculada correctamente.',
    })
    expect(mockWithLockedRoots.mock.calls[0][0]).toEqual([
      { type: 'vehicle', id: 'veh-1' },
      { type: 'sellerLead', id: 'seller-1' },
      { type: 'buyerLead', id: 'buyer-1' },
    ])
    expect(mockDb.activity.create).toHaveBeenCalledTimes(2)
  })
})
