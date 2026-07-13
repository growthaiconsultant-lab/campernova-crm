import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown) => fn,
}))

vi.mock('@/lib/db', () => ({ db: {} }))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    vehicle: { findMany: vi.fn(), count: vi.fn() },
    sellerLead: { findMany: vi.fn(), count: vi.fn() },
    activity: { findMany: vi.fn() },
    postventaTicket: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    workOrder: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  }
  return { mockDb }
})

import {
  getStockValue,
  getAverageDaysInStock,
  getStagnantVehicles,
  getMonthlyNetMargin,
  getPublishedToSoldRate,
  getLeadAcceptanceRate,
  getAveragePostventaCostPerVehicle,
  getVehiclesPerCommercial,
  getAverageWorkshopHoursPerVehicle,
  getAverageTicket,
} from './metrics'

const emptyFilter = { agentId: null }

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── getStockValue ────────────────────────────────────────────────────────────

describe('getStockValue', () => {
  it('returns zeros when no vehicles', async () => {
    mockDb.vehicle.findMany.mockResolvedValue([])
    const result = await getStockValue(mockDb as never, emptyFilter)
    expect(result.totalStockValue).toBe(0)
    expect(result.committedInvestment).toBe(0)
    expect(result.potentialMargin).toBe(0)
    expect(result.vehicleCount).toBe(0)
  })

  it('sums salePrice as stock value', async () => {
    mockDb.vehicle.findMany.mockResolvedValue([
      { salePrice: 30000, valuationRecommended: null, purchasePrice: 25000, costs: [] },
      { salePrice: 20000, valuationRecommended: null, purchasePrice: 18000, costs: [] },
    ])
    const result = await getStockValue(mockDb as never, emptyFilter)
    expect(result.totalStockValue).toBe(50000)
    expect(result.committedInvestment).toBe(43000)
    expect(result.vehicleCount).toBe(2)
  })

  it('falls back to valuationRecommended when salePrice is null', async () => {
    mockDb.vehicle.findMany.mockResolvedValue([
      { salePrice: null, valuationRecommended: 15000, purchasePrice: null, costs: [] },
    ])
    const result = await getStockValue(mockDb as never, emptyFilter)
    expect(result.totalStockValue).toBe(15000)
    expect(result.committedInvestment).toBe(0)
  })

  it('subtracts costs from potential margin', async () => {
    mockDb.vehicle.findMany.mockResolvedValue([
      {
        salePrice: 30000,
        valuationRecommended: null,
        purchasePrice: 25000,
        costs: [{ amount: 500 }, { amount: 300 }],
      },
    ])
    const result = await getStockValue(mockDb as never, emptyFilter)
    expect(result.potentialMargin).toBe(30000 - 25000 - 800)
  })
})

// ─── getAverageDaysInStock ────────────────────────────────────────────────────

describe('getAverageDaysInStock', () => {
  it('returns null average when no vehicles', async () => {
    mockDb.vehicle.findMany.mockResolvedValue([])
    const result = await getAverageDaysInStock(mockDb as never, emptyFilter)
    expect(result.averageDays).toBeNull()
    expect(result.over90Count).toBe(0)
  })

  it('calculates average days using createdAt', async () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    mockDb.vehicle.findMany.mockResolvedValue([{ entryDate: null, createdAt: sixtyDaysAgo }])
    const result = await getAverageDaysInStock(mockDb as never, emptyFilter)
    expect(result.averageDays).toBe(60)
    expect(result.over90Count).toBe(0)
  })

  it('prefers entryDate over createdAt', async () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    mockDb.vehicle.findMany.mockResolvedValue([
      { entryDate: ninetyDaysAgo, createdAt: thirtyDaysAgo },
    ])
    const result = await getAverageDaysInStock(mockDb as never, emptyFilter)
    // entryDate=90d ago → ~90 days; if using createdAt=30d ago → 30 days
    expect(result.averageDays).toBeGreaterThanOrEqual(89)
  })

  it('counts vehicles over 90 days', async () => {
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    mockDb.vehicle.findMany.mockResolvedValue([
      { entryDate: null, createdAt: hundredDaysAgo },
      { entryDate: null, createdAt: tenDaysAgo },
    ])
    const result = await getAverageDaysInStock(mockDb as never, emptyFilter)
    expect(result.over90Count).toBe(1)
  })
})

// ─── getStagnantVehicles ──────────────────────────────────────────────────────

describe('getStagnantVehicles', () => {
  it('returns empty array when no stagnant vehicles', async () => {
    mockDb.vehicle.findMany.mockResolvedValue([])
    const result = await getStagnantVehicles(mockDb as never, emptyFilter)
    expect(result).toHaveLength(0)
  })

  it('maps vehicle fields correctly', async () => {
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
    mockDb.vehicle.findMany.mockResolvedValue([
      {
        id: 'v-1',
        brand: 'Volkswagen',
        model: 'California',
        year: 2020,
        status: 'TASADO',
        updatedAt: hundredDaysAgo,
        salePrice: 35000,
        purchasePrice: 30000,
        sellerLead: { id: 'sl-1' },
      },
    ])
    const result = await getStagnantVehicles(mockDb as never, emptyFilter)
    expect(result[0].brand).toBe('Volkswagen')
    expect(result[0].daysInStatus).toBeGreaterThanOrEqual(99)
    expect(result[0].salePrice).toBe(35000)
    expect(result[0].sellerLeadId).toBe('sl-1')
  })

  it('handles null sellerLead gracefully', async () => {
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
    mockDb.vehicle.findMany.mockResolvedValue([
      {
        id: 'v-2',
        brand: 'Adria',
        model: 'Matrix',
        year: 2019,
        status: 'NUEVO',
        updatedAt: hundredDaysAgo,
        salePrice: null,
        purchasePrice: null,
        sellerLead: null,
      },
    ])
    const result = await getStagnantVehicles(mockDb as never, emptyFilter)
    expect(result[0].sellerLeadId).toBeNull()
    expect(result[0].salePrice).toBeNull()
  })
})

// ─── getMonthlyNetMargin ──────────────────────────────────────────────────────

describe('getMonthlyNetMargin', () => {
  it('returns zeros when no canonical sales this month', async () => {
    // Fuente canónica: vehículos VENDIDO con soldAt en el mes. Sin ventas → sin vehículos.
    mockDb.vehicle.findMany.mockResolvedValue([])
    const result = await getMonthlyNetMargin(mockDb as never, emptyFilter)
    expect(result.netMargin).toBe(0)
    expect(result.vehiclesSold).toBe(0)
    expect(result.averageTicket).toBeNull()
    // No debe leer `Activity` para contar ventas.
    expect(mockDb.activity.findMany).not.toHaveBeenCalled()
  })

  it('calculates net margin from canonical sold vehicles', async () => {
    mockDb.vehicle.findMany.mockResolvedValue([
      { salePrice: 30000, purchasePrice: 25000, costs: [{ amount: 500 }] },
      { salePrice: 20000, purchasePrice: 17000, costs: [] },
    ])
    const result = await getMonthlyNetMargin(mockDb as never, emptyFilter)
    // gross revenue: 50000, purchase: 42000, costs: 500, net: 7500
    expect(result.grossRevenue).toBe(50000)
    expect(result.netMargin).toBe(50000 - 42000 - 500)
    expect(result.vehiclesSold).toBe(2)
    // La consulta es sobre el hecho canónico (status VENDIDO + soldAt en el mes), no Activity.
    const whereArg = mockDb.vehicle.findMany.mock.calls[0][0].where
    expect(whereArg.status).toBe('VENDIDO')
    expect(whereArg.soldAt).toHaveProperty('gte')
    expect(whereArg.soldAt).toHaveProperty('lt')
    expect(mockDb.activity.findMany).not.toHaveBeenCalled()
  })

  it('counts vehiclesSold as the number of canonical sold vehicles (no dedup needed)', async () => {
    mockDb.vehicle.findMany.mockResolvedValue([
      { salePrice: 30000, purchasePrice: 25000, costs: [] },
    ])
    const result = await getMonthlyNetMargin(mockDb as never, emptyFilter)
    expect(result.vehiclesSold).toBe(1)
  })
})

// ─── getPublishedToSoldRate ────────────────────────────────────────────────────

describe('getPublishedToSoldRate', () => {
  it('returns null rate when no published vehicles', async () => {
    mockDb.vehicle.count.mockResolvedValue(0)
    const result = await getPublishedToSoldRate(mockDb as never, emptyFilter)
    expect(result.rate).toBeNull()
    expect(result.published).toBe(0)
  })

  it('calculates conversion rate correctly', async () => {
    mockDb.vehicle.count
      .mockResolvedValueOnce(10) // published
      .mockResolvedValueOnce(4) // sold
    const result = await getPublishedToSoldRate(mockDb as never, emptyFilter)
    expect(result.rate).toBe(40)
    expect(result.published).toBe(10)
    expect(result.sold).toBe(4)
  })
})

// ─── getLeadAcceptanceRate ─────────────────────────────────────────────────────

describe('getLeadAcceptanceRate', () => {
  it('returns both channels', async () => {
    mockDb.sellerLead.count
      .mockResolvedValueOnce(20) // PRO total
      .mockResolvedValueOnce(15) // PRO published
      .mockResolvedValueOnce(8) // PRO sold
      .mockResolvedValueOnce(10) // CN total
      .mockResolvedValueOnce(9) // CN published
      .mockResolvedValueOnce(5) // CN sold
    const result = await getLeadAcceptanceRate(mockDb as never, emptyFilter)
    expect(result.pro.total).toBe(20)
    expect(result.pro.pubRate).toBe(75)
    expect(result.cn.total).toBe(10)
  })

  it('handles zero totals gracefully', async () => {
    mockDb.sellerLead.count.mockResolvedValue(0)
    const result = await getLeadAcceptanceRate(mockDb as never, emptyFilter)
    expect(result.pro.pubRate).toBeNull()
    expect(result.cn.soldRate).toBeNull()
  })
})

// ─── getAveragePostventaCostPerVehicle ────────────────────────────────────────

describe('getAveragePostventaCostPerVehicle', () => {
  it('returns null average when no tickets with cost', async () => {
    mockDb.postventaTicket.findMany.mockResolvedValue([])
    const result = await getAveragePostventaCostPerVehicle(mockDb as never, emptyFilter)
    expect(result.averageCost).toBeNull()
    expect(result.totalCost).toBe(0)
  })

  it('averages cost across unique vehicles', async () => {
    mockDb.postventaTicket.findMany.mockResolvedValue([
      { costReal: 300, warranty: { delivery: { vehicleId: 'v-1' } } },
      { costReal: 200, warranty: { delivery: { vehicleId: 'v-1' } } },
      { costReal: 500, warranty: { delivery: { vehicleId: 'v-2' } } },
    ])
    const result = await getAveragePostventaCostPerVehicle(mockDb as never, emptyFilter)
    // total = 1000, vehicles = 2, average = 500
    expect(result.totalCost).toBe(1000)
    expect(result.vehicleCount).toBe(2)
    expect(result.averageCost).toBe(500)
  })
})

// ─── getVehiclesPerCommercial ─────────────────────────────────────────────────

describe('getVehiclesPerCommercial', () => {
  it('returns empty array when no active agents', async () => {
    mockDb.user.findMany.mockResolvedValue([])
    const result = await getVehiclesPerCommercial(mockDb as never)
    expect(result).toHaveLength(0)
  })

  it('maps active and published vehicle counts per agent', async () => {
    mockDb.user.findMany.mockResolvedValue([
      {
        id: 'agent-1',
        name: 'Desirée López',
        sellerLeads: [
          { vehicle: { status: 'PUBLICADO' } },
          { vehicle: { status: 'TASADO' } },
          { vehicle: { status: 'VENDIDO' } },
          { vehicle: null },
        ],
      },
    ])
    const result = await getVehiclesPerCommercial(mockDb as never)
    expect(result[0].active).toBe(2) // PUBLICADO + TASADO in STOCK_STATUSES
    expect(result[0].published).toBe(1) // only PUBLICADO
  })
})

// ─── getAverageWorkshopHoursPerVehicle ────────────────────────────────────────

describe('getAverageWorkshopHoursPerVehicle', () => {
  it('returns null when no completed orders', async () => {
    mockDb.workOrder.findMany.mockResolvedValue([])
    const result = await getAverageWorkshopHoursPerVehicle(mockDb as never, emptyFilter)
    expect(result.averageHours).toBeNull()
    expect(result.totalHours).toBe(0)
    expect(result.vehicleCount).toBe(0)
  })

  it('aggregates hours per vehicle correctly', async () => {
    mockDb.workOrder.findMany.mockResolvedValue([
      { vehicleId: 'v-1', timeEntries: [{ hours: 3 }, { hours: 2 }] },
      { vehicleId: 'v-1', timeEntries: [{ hours: 1 }] }, // second order for same vehicle
      { vehicleId: 'v-2', timeEntries: [{ hours: 8 }] },
    ])
    const result = await getAverageWorkshopHoursPerVehicle(mockDb as never, emptyFilter)
    // v-1: 6h, v-2: 8h, total: 14h, average: 7h
    expect(result.totalHours).toBe(14)
    expect(result.vehicleCount).toBe(2)
    expect(result.averageHours).toBe(7)
  })
})

// ─── getAverageTicket ─────────────────────────────────────────────────────────

describe('getAverageTicket', () => {
  it('returns null ticket when no sales this month', async () => {
    mockDb.vehicle.findMany.mockResolvedValue([])
    const result = await getAverageTicket(mockDb as never, emptyFilter)
    expect(result.averageTicket).toBeNull()
    expect(result.vehiclesSold).toBe(0)
  })

  it('calculates average ticket from sale prices', async () => {
    mockDb.vehicle.findMany.mockResolvedValue([
      { salePrice: 40000, purchasePrice: 35000, costs: [] },
      { salePrice: 20000, purchasePrice: 15000, costs: [] },
    ])
    const result = await getAverageTicket(mockDb as never, emptyFilter)
    expect(result.averageTicket).toBe(30000)
    expect(result.vehiclesSold).toBe(2)
  })
})
