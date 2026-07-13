import type { PrismaClient, SellerLeadStatus, BuyerLeadStatus, VehicleStatus } from '@prisma/client'

export type DashboardFilter = {
  agentId?: string | null // null/undefined = todos los agentes
}

export type StatusCount<T extends string> = { status: T; count: number }

/// Counts agrupados por estado para SellerLead.
export async function getSellerLeadCounts(
  db: PrismaClient,
  filter: DashboardFilter
): Promise<StatusCount<SellerLeadStatus>[]> {
  const groups = await db.sellerLead.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: filter.agentId ? { agentId: filter.agentId } : undefined,
  })
  return groups.map((g) => ({ status: g.status, count: g._count._all }))
}

export async function getBuyerLeadCounts(
  db: PrismaClient,
  filter: DashboardFilter
): Promise<StatusCount<BuyerLeadStatus>[]> {
  const groups = await db.buyerLead.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: filter.agentId ? { agentId: filter.agentId } : undefined,
  })
  return groups.map((g) => ({ status: g.status, count: g._count._all }))
}

export async function getVehicleCounts(
  db: PrismaClient,
  filter: DashboardFilter
): Promise<StatusCount<VehicleStatus>[]> {
  const groups = await db.vehicle.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: filter.agentId ? { sellerLead: { agentId: filter.agentId } } : undefined,
  })
  return groups.map((g) => ({ status: g.status, count: g._count._all }))
}

/// Cuenta ventas del periodo desde el hecho canónico del vehículo: `status = VENDIDO`
/// con `soldAt` dentro del rango `[start, end)`. La fecha de venta es `Vehicle.soldAt`
/// (estructurada), NO el texto de la timeline (`Activity`). Cada vehículo es único, así que
/// `vehicle.count` no puede duplicar una venta.
export async function getSalesInRange(
  db: PrismaClient,
  filter: DashboardFilter,
  start: Date,
  end: Date
): Promise<number> {
  return db.vehicle.count({
    where: {
      status: 'VENDIDO',
      soldAt: { gte: start, lt: end },
      ...(filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}),
    },
  })
}

export type SalesDelta = {
  current: number
  previous: number
  delta: number // current - previous
  pctChange: number | null // null si previous === 0
}

export async function getSalesMonthOverMonth(
  db: PrismaClient,
  filter: DashboardFilter,
  reference: Date = new Date()
): Promise<SalesDelta> {
  const startCurrent = new Date(reference.getFullYear(), reference.getMonth(), 1)
  const startNext = new Date(reference.getFullYear(), reference.getMonth() + 1, 1)
  const startPrev = new Date(reference.getFullYear(), reference.getMonth() - 1, 1)

  const [current, previous] = await Promise.all([
    getSalesInRange(db, filter, startCurrent, startNext),
    getSalesInRange(db, filter, startPrev, startCurrent),
  ])

  return {
    current,
    previous,
    delta: current - previous,
    pctChange: previous === 0 ? null : ((current - previous) / previous) * 100,
  }
}

export type ProFunnel = {
  leadsPro: number
  publicados: number
  vendidos: number
  pubRate: number | null // % publicados / leadsPro
  vendRate: number | null // % vendidos / publicados
  totalRate: number | null // % vendidos / leadsPro
}

/// Funnel canal Pro: leads recibidos → vehículos que llegaron a PUBLICADO → vendidos.
/// "Llegaron a publicado" = current status ∈ {PUBLICADO, RESERVADO, VENDIDO}
/// (estados posteriores a PUBLICADO en la máquina).
export async function getProFunnel(db: PrismaClient, filter: DashboardFilter): Promise<ProFunnel> {
  const baseWhere = {
    canal: 'PRO' as const,
    ...(filter.agentId ? { agentId: filter.agentId } : {}),
  }

  const [leadsPro, publicados, vendidos] = await Promise.all([
    db.sellerLead.count({ where: baseWhere }),
    db.sellerLead.count({
      where: {
        ...baseWhere,
        vehicle: { status: { in: ['PUBLICADO', 'RESERVADO', 'VENDIDO'] } },
      },
    }),
    db.sellerLead.count({
      where: {
        ...baseWhere,
        vehicle: { status: 'VENDIDO' },
      },
    }),
  ])

  return {
    leadsPro,
    publicados,
    vendidos,
    pubRate: leadsPro === 0 ? null : (publicados / leadsPro) * 100,
    vendRate: publicados === 0 ? null : (vendidos / publicados) * 100,
    totalRate: leadsPro === 0 ? null : (vendidos / leadsPro) * 100,
  }
}
