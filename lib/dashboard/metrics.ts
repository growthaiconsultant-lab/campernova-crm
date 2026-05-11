import type { PrismaClient } from '@prisma/client'
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import type { DashboardFilter } from './queries'

// ── Types ─────────────────────────────────────────────────────────────────────

export type StockValueResult = {
  totalStockValue: number
  committedInvestment: number
  potentialMargin: number
  vehicleCount: number
}

export type DaysInStockResult = {
  averageDays: number | null
  over90Count: number
}

export type StagnantVehicle = {
  id: string
  brand: string
  model: string
  year: number | null
  status: string
  daysInStatus: number
  sellerLeadId: string | null
  salePrice: number | null
  purchasePrice: number | null
}

export type MonthlyNetMarginResult = {
  netMargin: number
  grossRevenue: number
  totalCosts: number
  vehiclesSold: number
  averageTicket: number | null
}

export type FunnelChannelData = {
  total: number
  published: number
  sold: number
  pubRate: number | null
  soldRate: number | null
}

export type FunnelComparisonResult = {
  pro: FunnelChannelData
  cn: FunnelChannelData
}

export type StockSnapshot = {
  month: string
  vehicleCount: number
  stockValue: number
}

export type VehiclesPerCommercialResult = {
  agentId: string
  agentName: string
  active: number
  published: number
}

// ── Active vehicle states (in stock) ─────────────────────────────────────────

const STOCK_STATUSES = ['NUEVO', 'TASADO', 'PUBLICADO', 'RESERVADO'] as const

// ── 1. Stock value & committed investment ─────────────────────────────────────

export async function getStockValue(
  database: PrismaClient,
  filter: DashboardFilter
): Promise<StockValueResult> {
  const vehicles = await database.vehicle.findMany({
    where: {
      status: { in: [...STOCK_STATUSES] },
      ...(filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}),
    },
    select: {
      purchasePrice: true,
      salePrice: true,
      valuationRecommended: true,
      costs: { select: { amount: true } },
    },
  })

  let totalStockValue = 0
  let committedInvestment = 0
  let totalCosts = 0

  for (const v of vehicles) {
    const price = v.salePrice ?? v.valuationRecommended
    if (price) totalStockValue += Number(price)
    if (v.purchasePrice) committedInvestment += Number(v.purchasePrice)
    totalCosts += v.costs.reduce((s, c) => s + Number(c.amount), 0)
  }

  return {
    totalStockValue,
    committedInvestment,
    potentialMargin: totalStockValue - committedInvestment - totalCosts,
    vehicleCount: vehicles.length,
  }
}

// ── 2. Average days in stock + over-90 count ─────────────────────────────────

export async function getAverageDaysInStock(
  database: PrismaClient,
  filter: DashboardFilter
): Promise<DaysInStockResult> {
  const now = new Date()
  const vehicles = await database.vehicle.findMany({
    where: {
      status: { in: [...STOCK_STATUSES] },
      ...(filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}),
    },
    select: { entryDate: true, createdAt: true },
  })

  if (vehicles.length === 0) return { averageDays: null, over90Count: 0 }

  const daysArr = vehicles.map((v) => {
    const ref = v.entryDate ?? v.createdAt
    return (now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24)
  })

  const average = daysArr.reduce((s, d) => s + d, 0) / daysArr.length
  const over90Count = daysArr.filter((d) => d > 90).length

  return { averageDays: Math.round(average), over90Count }
}

// ── 3. Stagnant vehicles (>90 days in current state) ─────────────────────────

export async function getStagnantVehicles(
  database: PrismaClient,
  filter: DashboardFilter,
  thresholdDays = 90
): Promise<StagnantVehicle[]> {
  const now = new Date()
  const cutoff = new Date(now.getTime() - thresholdDays * 24 * 60 * 60 * 1000)

  const vehicles = await database.vehicle.findMany({
    where: {
      status: { in: [...STOCK_STATUSES] },
      updatedAt: { lt: cutoff },
      ...(filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}),
    },
    select: {
      id: true,
      brand: true,
      model: true,
      year: true,
      status: true,
      updatedAt: true,
      salePrice: true,
      purchasePrice: true,
      sellerLead: { select: { id: true } },
    },
    orderBy: { updatedAt: 'asc' },
    take: 20,
  })

  return vehicles.map((v) => ({
    id: v.id,
    brand: v.brand,
    model: v.model,
    year: v.year,
    status: v.status,
    daysInStatus: Math.floor((now.getTime() - v.updatedAt.getTime()) / (1000 * 60 * 60 * 24)),
    sellerLeadId: v.sellerLead?.id ?? null,
    salePrice: v.salePrice ? Number(v.salePrice) : null,
    purchasePrice: v.purchasePrice ? Number(v.purchasePrice) : null,
  }))
}

// ── 4. Monthly net margin + average ticket ────────────────────────────────────

export async function getMonthlyNetMargin(
  database: PrismaClient,
  filter: DashboardFilter,
  reference: Date = new Date()
): Promise<MonthlyNetMarginResult> {
  const startOfMonth = new Date(reference.getFullYear(), reference.getMonth(), 1)
  const startOfNext = new Date(reference.getFullYear(), reference.getMonth() + 1, 1)

  // Find vehicles sold this month via activity log
  const soldActivities = await database.activity.findMany({
    where: {
      type: 'CAMBIO_ESTADO',
      content: { contains: '→ Vendido' },
      createdAt: { gte: startOfMonth, lt: startOfNext },
      sellerLead: filter.agentId ? { agentId: filter.agentId } : undefined,
    },
    select: { sellerLeadId: true },
  })

  const sellerLeadIds = Array.from(
    new Set(soldActivities.map((a) => a.sellerLeadId).filter(Boolean) as string[])
  )

  if (sellerLeadIds.length === 0) {
    return { netMargin: 0, grossRevenue: 0, totalCosts: 0, vehiclesSold: 0, averageTicket: null }
  }

  const vehicles = await database.vehicle.findMany({
    where: { sellerLeadId: { in: sellerLeadIds } },
    select: {
      salePrice: true,
      purchasePrice: true,
      costs: { select: { amount: true } },
    },
  })

  let grossRevenue = 0
  let totalPurchase = 0
  let totalCosts = 0

  for (const v of vehicles) {
    if (v.salePrice) grossRevenue += Number(v.salePrice)
    if (v.purchasePrice) totalPurchase += Number(v.purchasePrice)
    totalCosts += v.costs.reduce((s, c) => s + Number(c.amount), 0)
  }

  const netMargin = grossRevenue - totalPurchase - totalCosts
  const vehiclesSold = sellerLeadIds.length
  const averageTicket = vehiclesSold > 0 ? grossRevenue / vehiclesSold : null

  return { netMargin, grossRevenue, totalCosts, vehiclesSold, averageTicket }
}

// ── 5. Published → sold conversion rate ──────────────────────────────────────

export async function getPublishedToSoldRate(
  database: PrismaClient,
  filter: DashboardFilter
): Promise<{ rate: number | null; published: number; sold: number }> {
  const whereBase = filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}

  const [published, sold] = await Promise.all([
    database.vehicle.count({
      where: {
        status: { in: ['PUBLICADO', 'RESERVADO', 'VENDIDO'] },
        ...whereBase,
      },
    }),
    database.vehicle.count({ where: { status: 'VENDIDO', ...whereBase } }),
  ])

  return {
    rate: published === 0 ? null : (sold / published) * 100,
    published,
    sold,
  }
}

// ── 6. Lead acceptance rate (PRO vs CN) ──────────────────────────────────────

export async function getLeadAcceptanceRate(
  database: PrismaClient,
  filter: DashboardFilter
): Promise<FunnelComparisonResult> {
  const agentWhere = filter.agentId ? { agentId: filter.agentId } : {}

  const [proCounts, cnCounts] = await Promise.all([
    getChannelCounts(database, 'PRO', agentWhere),
    getChannelCounts(database, 'CN', agentWhere),
  ])

  return { pro: proCounts, cn: cnCounts }
}

async function getChannelCounts(
  database: PrismaClient,
  canal: 'PRO' | 'CN',
  agentWhere: { agentId?: string }
): Promise<FunnelChannelData> {
  const baseWhere = { canal: canal as 'PRO' | 'CN', ...agentWhere }

  const [total, published, sold] = await Promise.all([
    database.sellerLead.count({ where: baseWhere }),
    database.sellerLead.count({
      where: { ...baseWhere, vehicle: { status: { in: ['PUBLICADO', 'RESERVADO', 'VENDIDO'] } } },
    }),
    database.sellerLead.count({
      where: { ...baseWhere, vehicle: { status: 'VENDIDO' } },
    }),
  ])

  return {
    total,
    published,
    sold,
    pubRate: total === 0 ? null : (published / total) * 100,
    soldRate: published === 0 ? null : (sold / published) * 100,
  }
}

// ── 7. Average postventa cost per vehicle ─────────────────────────────────────

export async function getAveragePostventaCostPerVehicle(
  database: PrismaClient,
  filter: DashboardFilter
): Promise<{ averageCost: number | null; totalCost: number; vehicleCount: number }> {
  const tickets = await database.postventaTicket.findMany({
    where: {
      costReal: { not: null, gt: 0 },
      ...(filter.agentId
        ? { warranty: { delivery: { vehicle: { sellerLead: { agentId: filter.agentId } } } } }
        : {}),
    },
    select: {
      costReal: true,
      warranty: { select: { delivery: { select: { vehicleId: true } } } },
    },
  })

  const vehicleSet = new Set<string>()
  let totalCost = 0

  for (const t of tickets) {
    if (t.costReal) totalCost += Number(t.costReal)
    const vehicleId = t.warranty?.delivery?.vehicleId
    if (vehicleId) vehicleSet.add(vehicleId)
  }

  const vehicleCount = vehicleSet.size
  return {
    averageCost: vehicleCount === 0 ? null : totalCost / vehicleCount,
    totalCost,
    vehicleCount,
  }
}

// ── 8. Vehicles per commercial ────────────────────────────────────────────────

export async function getVehiclesPerCommercial(
  database: PrismaClient
): Promise<VehiclesPerCommercialResult[]> {
  const agents = await database.user.findMany({
    where: { active: true, role: { in: ['ADMIN', 'AGENTE'] } },
    select: {
      id: true,
      name: true,
      sellerLeads: {
        select: {
          vehicle: { select: { status: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return agents.map((a) => {
    const vehicles = a.sellerLeads.flatMap((sl) => (sl.vehicle ? [sl.vehicle] : []))
    return {
      agentId: a.id,
      agentName: a.name,
      active: vehicles.filter((v) =>
        STOCK_STATUSES.includes(v.status as (typeof STOCK_STATUSES)[number])
      ).length,
      published: vehicles.filter((v) => v.status === 'PUBLICADO').length,
    }
  })
}

// ── 9. Average workshop hours per vehicle ─────────────────────────────────────

export async function getAverageWorkshopHoursPerVehicle(
  database: PrismaClient,
  filter: DashboardFilter
): Promise<{ averageHours: number | null; totalHours: number; vehicleCount: number }> {
  const orders = await database.workOrder.findMany({
    where: {
      status: 'COMPLETADA',
      ...(filter.agentId ? { vehicle: { sellerLead: { agentId: filter.agentId } } } : {}),
    },
    select: {
      vehicleId: true,
      timeEntries: { select: { hours: true } },
    },
  })

  const vehicleHours = new Map<string, number>()
  for (const o of orders) {
    const hours = o.timeEntries.reduce((s, e) => s + Number(e.hours), 0)
    vehicleHours.set(o.vehicleId, (vehicleHours.get(o.vehicleId) ?? 0) + hours)
  }

  const vehicleCount = vehicleHours.size
  const totalHours = Array.from(vehicleHours.values()).reduce((s, h) => s + h, 0)

  return {
    averageHours: vehicleCount === 0 ? null : totalHours / vehicleCount,
    totalHours,
    vehicleCount,
  }
}

// ── 10. Stock history snapshot (cached — heavy query) ─────────────────────────

export type StockHistoryResult = StockSnapshot[]

export const getStockHistorySnapshot = unstable_cache(
  async (): Promise<StockHistoryResult> => {
    // Monthly snapshots: how many vehicles were in active states per month
    // We approximate by counting vehicles created before month-end that hadn't been
    // sold/discarded before month-start. This is a best-effort approximation.
    const rows = await db.$queryRaw<{ month: string; count: bigint; value: number | null }[]>`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', NOW() - INTERVAL '11 months'),
          date_trunc('month', NOW()),
          '1 month'::interval
        ) AS month_start
      )
      SELECT
        TO_CHAR(m.month_start, 'YYYY-MM') AS month,
        COUNT(v.id) AS count,
        SUM(COALESCE(v.sale_price, v.valuation_recommended)::numeric) AS value
      FROM months m
      LEFT JOIN vehicles v ON
        v.created_at < (m.month_start + INTERVAL '1 month')
        AND (v.status NOT IN ('VENDIDO', 'DESCARTADO') OR v.updated_at >= m.month_start)
      GROUP BY m.month_start
      ORDER BY m.month_start ASC
    `

    return rows.map((r) => ({
      month: r.month,
      vehicleCount: Number(r.count),
      stockValue: r.value ? Number(r.value) : 0,
    }))
  },
  ['stock-history-snapshot'],
  { revalidate: 300 }
)

// ── 11. Funnel comparison Pro vs CN ──────────────────────────────────────────

export async function getFunnelComparison(
  database: PrismaClient,
  filter: DashboardFilter
): Promise<FunnelComparisonResult> {
  return getLeadAcceptanceRate(database, filter)
}

// ── 12. Average ticket price (sold vehicles, current month) ──────────────────

export async function getAverageTicket(
  database: PrismaClient,
  filter: DashboardFilter,
  reference: Date = new Date()
): Promise<{ averageTicket: number | null; vehiclesSold: number }> {
  const result = await getMonthlyNetMargin(database, filter, reference)
  return {
    averageTicket: result.averageTicket,
    vehiclesSold: result.vehiclesSold,
  }
}
