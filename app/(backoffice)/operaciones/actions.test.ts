import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  role: vi.fn(),
  vehicle: { findUnique: vi.fn(), findMany: vi.fn() },
  buyerLead: { findMany: vi.fn() },
  sellerLead: { findMany: vi.fn() },
  delivery: { findUnique: vi.fn() },
  item: { findUnique: vi.fn() },
  lock: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ requireRole: mock.role }))
vi.mock('@/lib/db', () => ({
  db: {
    vehicle: mock.vehicle,
    buyerLead: mock.buyerLead,
    sellerLead: mock.sellerLead,
    delivery: mock.delivery,
    deliveryChecklistItem: mock.item,
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/locking', () => ({ withLockedRoots: mock.lock, isLockError: () => false }))
import {
  createManualDelivery,
  changeManualDelivery,
  updateOperationalChecklist,
  searchOperationalTargets,
} from './actions'
import { OPERATIONAL_DELIVERY_ROLES } from '@/lib/operations-policy'
beforeEach(() => {
  vi.resetAllMocks()
  mock.role.mockResolvedValue({ id: 'qa', role: 'TALLER', active: true })
})
afterEach(() => vi.unstubAllEnvs())
const calls = [
  () => createManualDelivery({}),
  () => changeManualDelivery({}),
  () => updateOperationalChecklist('qa', { result: 'OK' }),
]
describe('OPS-1 acciones operativas', () => {
  it.each([0, 1, 2])('guard precede a toda lectura/escritura en acción %s', async (index) => {
    mock.role.mockRejectedValue(new Error('forbidden'))
    await expect(calls[index]()).rejects.toThrow('forbidden')
    expect(mock.role).toHaveBeenCalledWith(OPERATIONAL_DELIVERY_ROLES)
    expect(mock.vehicle.findUnique).not.toHaveBeenCalled()
    expect(mock.delivery.findUnique).not.toHaveBeenCalled()
    expect(mock.item.findUnique).not.toHaveBeenCalled()
    expect(mock.lock).not.toHaveBeenCalled()
  })
  it.each([0, 1, 2])('contingencia detiene acción %s antes de tocar DB', async (index) => {
    vi.stubEnv('OPS1_PAUSE_WRITES', 'true')
    expect((await calls[index]()).ok).toBe(false)
    expect(mock.vehicle.findUnique).not.toHaveBeenCalled()
    expect(mock.delivery.findUnique).not.toHaveBeenCalled()
    expect(mock.item.findUnique).not.toHaveBeenCalled()
    expect(mock.lock).not.toHaveBeenCalled()
  })
  it('buscador mínimo pagina sin entregar precios o datos bancarios', async () => {
    mock.vehicle.findMany.mockResolvedValue([
      { id: 'qa', brand: 'QA', model: 'Camper', plate: '1234ABC' },
    ])
    expect(await searchOperationalTargets({ type: 'vehicle', query: '1234 ABC', page: 2 })).toEqual(
      { ok: true, items: [{ id: 'qa', label: '1234ABC · QA Camper' }], hasMore: false }
    )
    expect(mock.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 21,
        skip: 40,
        select: { id: true, brand: true, model: true, plate: true },
      })
    )
  })
  it('no consulta tipos ni páginas manipulados', async () => {
    expect((await searchOperationalTargets({ type: 'user', query: '', page: 0 })).ok).toBe(false)
    expect((await searchOperationalTargets({ type: 'vehicle', query: '', page: -1 })).ok).toBe(
      false
    )
    expect(mock.vehicle.findMany).not.toHaveBeenCalled()
  })
})
