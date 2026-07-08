import type { PrismaClient } from '@prisma/client'
import type { DashboardFilter } from '@/lib/dashboard/queries'
import { ACTIVE_DEMAND_MATCH_THRESHOLD } from '@/lib/scoring'

/**
 * Bloque F3 KPIs — Dashboard Matching. Mide si el motor de matching genera
 * inteligencia comercial accionable: volumen, calidad (score), embudo por estado
 * y conversión a oferta. Lectura sobre `matches` + `offers`.
 */

const USEFUL_SCORE = 70

export type Bucket = { label: string; count: number }
export type MatchVehicleRow = { id: string; href: string; name: string; detail: string }

export type MatchingKpis = {
  total: number
  useful: number
  rejected: number
  avgScore: number
  matchesWithOffer: number
  offerConversionPct: number
  funnel: { label: string; count: number }[]
  scoreBuckets: Bucket[]
  topDemandRows: MatchVehicleRow[]
}

export async function getMatchingKpis(
  db: PrismaClient,
  filter: DashboardFilter
): Promise<MatchingKpis> {
  const matchWhere = filter.agentId ? { vehicle: { sellerLead: { agentId: filter.agentId } } } : {}

  const [total, useful, rejected, avg, statusGroups, scoreRows, offersWithMatch, topDemand] =
    await Promise.all([
      db.match.count({ where: matchWhere }),
      db.match.count({ where: { ...matchWhere, score: { gte: USEFUL_SCORE } } }),
      db.match.count({ where: { ...matchWhere, status: 'RECHAZADO' } }),
      db.match.aggregate({ _avg: { score: true }, where: matchWhere }),
      db.match.groupBy({ by: ['status'], _count: { _all: true }, where: matchWhere }),
      db.match.findMany({ where: matchWhere, select: { score: true } }),
      db.offer.findMany({
        where: { matchId: { not: null } },
        select: { matchId: true },
        distinct: ['matchId'],
      }),
      db.vehicle.findMany({
        where: {
          ...(filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}),
          status: { in: ['PUBLICADO', 'TASADO'] },
          matches: {
            some: {
              score: { gte: ACTIVE_DEMAND_MATCH_THRESHOLD },
              buyerLead: { status: { notIn: ['CERRADO', 'PERDIDO'] } },
            },
          },
        },
        select: {
          id: true,
          brand: true,
          model: true,
          year: true,
          sellerLead: { select: { id: true } },
          matches: {
            where: {
              score: { gte: ACTIVE_DEMAND_MATCH_THRESHOLD },
              buyerLead: { status: { notIn: ['CERRADO', 'PERDIDO'] } },
            },
            select: { id: true },
          },
        },
        take: 30,
      }),
    ])

  const by = (statuses: string[]) =>
    statusGroups.filter((g) => statuses.includes(g.status)).reduce((s, g) => s + g._count._all, 0)

  // Embudo acumulativo (RECHAZADO va aparte)
  const funnel = [
    {
      label: 'Sugerido',
      count: by(['SUGERIDO', 'PROPUESTO_CLIENTE', 'VISITA', 'OFERTA', 'CERRADO']),
    },
    { label: 'Propuesto', count: by(['PROPUESTO_CLIENTE', 'VISITA', 'OFERTA', 'CERRADO']) },
    { label: 'Visita', count: by(['VISITA', 'OFERTA', 'CERRADO']) },
    { label: 'Oferta', count: by(['OFERTA', 'CERRADO']) },
    { label: 'Cerrado', count: by(['CERRADO']) },
  ]

  const scoreBuckets: Bucket[] = [
    { label: '80-100', count: scoreRows.filter((r) => r.score >= 80).length },
    { label: '60-79', count: scoreRows.filter((r) => r.score >= 60 && r.score < 80).length },
    { label: '40-59', count: scoreRows.filter((r) => r.score >= 40 && r.score < 60).length },
    { label: '0-39', count: scoreRows.filter((r) => r.score < 40).length },
  ]

  const matchesWithOffer = offersWithMatch.length

  return {
    total,
    useful,
    rejected,
    avgScore: Math.round(avg._avg.score ?? 0),
    matchesWithOffer,
    offerConversionPct: total > 0 ? Math.round((matchesWithOffer / total) * 100) : 0,
    funnel,
    scoreBuckets,
    topDemandRows: topDemand
      .map((v) => ({
        id: v.id,
        href: v.sellerLead ? `/vendedores/${v.sellerLead.id}?tab=compradores` : '#',
        name: `${v.brand} ${v.model} ${v.year}`,
        count: v.matches.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((v) => ({
        id: v.id,
        href: v.href,
        name: v.name,
        detail: `${v.count} comprador${v.count === 1 ? '' : 'es'} compatible${v.count === 1 ? '' : 's'}`,
      })),
  }
}
