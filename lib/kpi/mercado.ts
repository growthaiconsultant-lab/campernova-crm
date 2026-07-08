import type { PrismaClient, BuyerLeadStatus, VehicleStatus } from '@prisma/client'
import type { DashboardFilter } from '@/lib/dashboard/queries'

/**
 * Bloque F4 KPIs — Dashboard Inteligencia de Mercado. Convierte los datos
 * operativos en decisiones de captación: demanda por segmento, gap oferta/
 * demanda, rotación por modelo y precio de cierre. Lectura sobre tablas.
 */

const ACTIVE_BUYER: BuyerLeadStatus[] = ['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION']
const STOCK: VehicleStatus[] = ['TASADO', 'PUBLICADO']

const PRICE_BUCKETS = [
  { label: '< 25.000 €', min: 0, max: 25000 },
  { label: '25-35.000 €', min: 25000, max: 35000 },
  { label: '35-45.000 €', min: 35000, max: 45000 },
  { label: '45-60.000 €', min: 45000, max: 60000 },
  { label: '60-80.000 €', min: 60000, max: 80000 },
  { label: '80.000 €+', min: 80000, max: Infinity },
]

const TYPE_LABEL: Record<string, string> = { CAMPER: 'Camper', AUTOCARAVANA: 'Autocaravana' }

export type Bar = { label: string; count: number }
export type GapRow = {
  id: string
  href: string
  name: string
  detail: string
}
export type CloseRow = { label: string; count: number }

export type MercadoKpis = {
  activeDemand: number
  uncoveredSegments: number
  avgClosePrice: number | null
  closedSales: number
  demandByType: Bar[]
  demandByPrice: Bar[]
  gapRows: GapRow[]
  rotationRows: GapRow[]
}

export async function getMercadoKpis(
  db: PrismaClient,
  filter: DashboardFilter
): Promise<MercadoKpis> {
  const buyerWhere = filter.agentId ? { agentId: filter.agentId } : {}
  const vehWhere = filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}

  const [buyers, stockVehicles, soldVehicles, closedOffers] = await Promise.all([
    db.buyerLead.findMany({
      where: { ...buyerWhere, status: { in: ACTIVE_BUYER } },
      select: { vehicleType: true, maxBudget: true },
    }),
    db.vehicle.groupBy({
      by: ['type'],
      _count: { _all: true },
      where: { ...vehWhere, status: { in: STOCK } },
    }),
    db.vehicle.findMany({
      where: { ...vehWhere, status: 'VENDIDO', publishedAt: { not: null }, soldAt: { not: null } },
      select: { brand: true, model: true, publishedAt: true, soldAt: true },
    }),
    db.offer.findMany({
      where: { status: 'CONVERTIDA' },
      select: { amount: true },
    }),
  ])

  const activeDemand = buyers.length

  // Demanda por tipo
  const typeCounts = new Map<string, number>()
  for (const b of buyers) {
    if (b.vehicleType) typeCounts.set(b.vehicleType, (typeCounts.get(b.vehicleType) ?? 0) + 1)
  }
  const demandByType: Bar[] = Array.from(typeCounts.entries())
    .map(([t, count]) => ({ label: TYPE_LABEL[t] ?? t, count }))
    .sort((a, b) => b.count - a.count)

  // Demanda por rango de precio
  const demandByPrice: Bar[] = PRICE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: buyers.filter(
      (b) =>
        b.maxBudget != null && Number(b.maxBudget) >= bucket.min && Number(b.maxBudget) < bucket.max
    ).length,
  })).filter((b) => b.count > 0)

  // Gap oferta/demanda por tipo (compradores explícitos - vehículos en stock)
  const stockByType = new Map<string, number>()
  for (const g of stockVehicles) stockByType.set(g.type, g._count._all)
  const gapRows: GapRow[] = (['CAMPER', 'AUTOCARAVANA'] as const)
    .map((t) => {
      const demand = typeCounts.get(t) ?? 0
      const supply = stockByType.get(t) ?? 0
      const gap = demand - supply
      return {
        id: t,
        href: `/compradores?tipo=${t}`,
        name: TYPE_LABEL[t],
        gap,
        detail: `${demand} demanda · ${supply} stock · gap ${gap > 0 ? '+' : ''}${gap}`,
      }
    })
    .sort((a, b) => b.gap - a.gap)
    .map(({ id, href, name, detail }) => ({ id, href, name, detail }))
  const uncoveredSegments = (['CAMPER', 'AUTOCARAVANA'] as const).filter(
    (t) => (typeCounts.get(t) ?? 0) > (stockByType.get(t) ?? 0)
  ).length

  // Rotación por modelo (días medios de venta)
  const modelMap = new Map<string, { total: number; count: number }>()
  for (const v of soldVehicles) {
    const days = Math.round((v.soldAt!.getTime() - v.publishedAt!.getTime()) / 86_400_000)
    const key = `${v.brand} ${v.model}`
    const cur = modelMap.get(key) ?? { total: 0, count: 0 }
    cur.total += days
    cur.count++
    modelMap.set(key, cur)
  }
  const rotationRows: GapRow[] = Array.from(modelMap.entries())
    .map(([name, { total, count }]) => ({
      id: name,
      href: '/vehiculos',
      name,
      avg: Math.round(total / count),
      count,
    }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      href: r.href,
      name: r.name,
      detail: `${r.avg} días · ${r.count} ventas`,
    }))

  const closedSales = closedOffers.length
  const avgClosePrice =
    closedSales > 0
      ? Math.round(closedOffers.reduce((s, o) => s + Number(o.amount), 0) / closedSales)
      : null

  return {
    activeDemand,
    uncoveredSegments,
    avgClosePrice,
    closedSales,
    demandByType,
    demandByPrice,
    gapRows,
    rotationRows,
  }
}
