import type { PrismaClient } from '@prisma/client'
import type { DashboardFilter } from '@/lib/dashboard/queries'
import { ACTIVE_DEMAND_MATCH_THRESHOLD } from '@/lib/scoring'

/**
 * Bloque F1 KPIs — cálculo de los KPIs del Dashboard Dirección. Se lee de las
 * tablas de negocio (no depende del histórico de kpi_events), así funciona desde
 * el día 1. Respeta el filtro de agente.
 */

const ACTIVE_BUYER = ['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION'] as const
const USEFUL_MATCH_SCORE = 70

export type DireccionKpis = {
  activeBuyers: number
  structuredOperations: number
  totalOperations: number
  structuredPct: number
  publishedVehicles: number
  capturedVehicles: number
  vehiclesWithDemand: number
  usefulMatches: number
  trustPct: number
  buyerFunnel: { label: string; count: number; href: string }[]
  vehicleFunnel: { label: string; count: number; href: string }[]
}

export async function getDireccionKpis(
  db: PrismaClient,
  filter: DashboardFilter
): Promise<DireccionKpis> {
  const buyerWhere = filter.agentId ? { agentId: filter.agentId } : {}
  const vehWhere = filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}

  const [
    activeBuyers,
    buyerStatusGroups,
    vehStatusGroups,
    usefulMatches,
    vehiclesWithDemand,
    capturedTotal,
    trustVerified,
    // North Star: operaciones estructuradas = comprador activo con match + próxima acción
    structuredOperations,
    totalOperations,
  ] = await Promise.all([
    db.buyerLead.count({ where: { ...buyerWhere, status: { in: [...ACTIVE_BUYER] } } }),
    db.buyerLead.groupBy({ by: ['status'], _count: { _all: true }, where: buyerWhere }),
    db.vehicle.groupBy({ by: ['status'], _count: { _all: true }, where: vehWhere }),
    db.match.count({
      where: {
        score: { gte: USEFUL_MATCH_SCORE },
        ...(filter.agentId ? { vehicle: { sellerLead: { agentId: filter.agentId } } } : {}),
      },
    }),
    db.vehicle.count({
      where: {
        ...vehWhere,
        status: { in: ['PUBLICADO', 'TASADO'] },
        matches: {
          some: {
            score: { gte: ACTIVE_DEMAND_MATCH_THRESHOLD },
            buyerLead: { status: { notIn: ['CERRADO', 'PERDIDO'] } },
          },
        },
      },
    }),
    db.vehicle.count({
      where: { ...vehWhere, status: { in: ['TASADO', 'PUBLICADO', 'RESERVADO', 'VENDIDO'] } },
    }),
    db.vehicle.count({ where: { ...vehWhere, trustVerifiedAt: { not: null } } }),
    db.buyerLead.count({
      where: {
        ...buyerWhere,
        status: { in: [...ACTIVE_BUYER] },
        nextActionType: { not: null },
        matches: { some: {} },
      },
    }),
    db.buyerLead.count({ where: { ...buyerWhere, status: { notIn: ['PERDIDO'] } } }),
  ])

  const buyerBy = (statuses: string[]) =>
    buyerStatusGroups
      .filter((g) => statuses.includes(g.status))
      .reduce((s, g) => s + g._count._all, 0)
  const vehBy = (statuses: string[]) =>
    vehStatusGroups
      .filter((g) => statuses.includes(g.status))
      .reduce((s, g) => s + g._count._all, 0)

  const publishedVehicles = vehBy(['PUBLICADO'])
  const capturedVehicles = vehBy(['TASADO', 'PUBLICADO', 'RESERVADO', 'VENDIDO'])

  // Funnels acumulativos (snapshot por estado)
  const buyerFunnel = [
    {
      label: 'Lead',
      count: buyerBy(['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO']),
      href: '/compradores',
    },
    {
      label: 'Contactado',
      count: buyerBy(['CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO']),
      href: '/compradores?estado=CONTACTADO',
    },
    {
      label: 'Cualificado',
      count: buyerBy(['CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO']),
      href: '/compradores?estado=CUALIFICADO',
    },
    {
      label: 'En negociación',
      count: buyerBy(['EN_NEGOCIACION', 'CERRADO']),
      href: '/compradores?estado=EN_NEGOCIACION',
    },
    { label: 'Venta', count: buyerBy(['CERRADO']), href: '/compradores?estado=CERRADO' },
  ]
  const vehicleFunnel = [
    {
      label: 'Captado',
      count: vehBy(['NUEVO', 'TASADO', 'PUBLICADO', 'RESERVADO', 'VENDIDO']),
      href: '/vendedores',
    },
    {
      label: 'Tasado',
      count: vehBy(['TASADO', 'PUBLICADO', 'RESERVADO', 'VENDIDO']),
      href: '/vendedores',
    },
    {
      label: 'Publicado',
      count: vehBy(['PUBLICADO', 'RESERVADO', 'VENDIDO']),
      href: '/vendedores',
    },
    { label: 'Reservado', count: vehBy(['RESERVADO', 'VENDIDO']), href: '/vendedores' },
    { label: 'Vendido', count: vehBy(['VENDIDO']), href: '/vendedores' },
  ]

  return {
    activeBuyers,
    structuredOperations,
    totalOperations,
    structuredPct:
      totalOperations > 0 ? Math.round((structuredOperations / totalOperations) * 100) : 0,
    publishedVehicles,
    capturedVehicles,
    vehiclesWithDemand,
    usefulMatches,
    trustPct: capturedTotal > 0 ? Math.round((trustVerified / capturedTotal) * 100) : 0,
    buyerFunnel,
    vehicleFunnel,
  }
}
