import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn(), auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { vehicle: { count: mocks.count, findMany: mocks.findMany } } }))
vi.mock('@/lib/auth', () => ({ requireCanViewVehiculos: mocks.auth }))
vi.mock('./vehicle-filters', () => ({ VehicleFilters: () => null }))
import VehiculosPage from './page'

describe('inventory plate search', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ role: 'AGENTE' })
    mocks.count.mockResolvedValue(0)
    mocks.findMany.mockResolvedValue([])
  })

  it('includes plates without replacing origin, admission or status filters', async () => {
    await VehiculosPage({ searchParams: { brand: '1234ABC', origin: 'PRO', status: 'PUBLICADO' } })
    const where = mocks.findMany.mock.calls[0][0].where
    expect(mocks.count.mock.calls[0][0].where).toEqual(where)
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([{ plate: { contains: '1234ABC', mode: 'insensitive' } }]),
        }),
        { status: 'PUBLICADO' },
      ])
    )
    expect(JSON.stringify(where)).toContain('ADMITIDO')
    expect(JSON.stringify(where)).toContain('PRO')
  })

  it('does not query on denied access', async () => {
    mocks.auth.mockRejectedValue(new Error('denied'))
    await expect(VehiculosPage({ searchParams: { brand: '1234ABC' } })).rejects.toThrow('denied')
    expect(mocks.findMany).not.toHaveBeenCalled()
    expect(mocks.count).not.toHaveBeenCalled()
  })
})
