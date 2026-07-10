import type { PrismaClient } from '@prisma/client'
import type { DashboardFilter } from '@/lib/dashboard/queries'
import type { ResolvedRange } from './range'

/**
 * KPIs de FLUJO por periodo (rediseño, spec §3): magnitudes que ocurren en una
 * ventana de tiempo y admiten comparativa vs el periodo anterior. Los KPIs de
 * ESTADO (stock actual, compradores activos, % trust…) no son parametrizables
 * por rango y siguen calculándose como snapshot en sus módulos.
 */

export type FlowKpi = {
  current: number
  previous: number
  /** Variación % vs periodo anterior; null si el anterior es 0 (no comparable). */
  deltaPct: number | null
}

export type FlowKpis = {
  range: { key: string; label: string }
  newBuyers: FlowKpi
  newSellers: FlowKpi
  capturedVehicles: FlowKpi
  offersCreated: FlowKpi
  newReservations: FlowKpi
  sales: FlowKpi
}

/** Variación % redondeada; null cuando no hay base de comparación. */
export function computeDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function toKpi(current: number, previous: number): FlowKpi {
  return { current, previous, deltaPct: computeDelta(current, previous) }
}

export async function getFlowKpis(
  db: PrismaClient,
  filter: DashboardFilter,
  range: ResolvedRange
): Promise<FlowKpis> {
  const buyerWhere = filter.agentId ? { agentId: filter.agentId } : {}
  const sellerWhere = filter.agentId ? { agentId: filter.agentId } : {}
  const vehWhere = filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}

  const window = (start: Date, end: Date) => ({ gte: start, lt: end })
  const cur = window(range.start, range.end)
  const prev = window(range.prevStart, range.prevEnd)

  // Ventas = transición real a Vendido, registrada en el activity log
  // (mismo criterio que lib/dashboard: CAMBIO_ESTADO con "→ Vendido").
  const salesWhere = (w: { gte: Date; lt: Date }) => ({
    type: 'CAMBIO_ESTADO' as const,
    content: { contains: '→ Vendido' },
    createdAt: w,
    ...(filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}),
  })

  // Reserva = oferta ACEPTADA con señal, decidida en el periodo.
  const reservationWhere = (w: { gte: Date; lt: Date }) => ({
    status: 'ACEPTADA' as const,
    depositAmount: { gt: 0 },
    decidedAt: w,
    ...(filter.agentId ? { buyerLead: { agentId: filter.agentId } } : {}),
  })

  const [
    newBuyersCur,
    newBuyersPrev,
    newSellersCur,
    newSellersPrev,
    capturedCur,
    capturedPrev,
    offersCur,
    offersPrev,
    reservationsCur,
    reservationsPrev,
    salesCur,
    salesPrev,
  ] = await Promise.all([
    db.buyerLead.count({ where: { ...buyerWhere, createdAt: cur } }),
    db.buyerLead.count({ where: { ...buyerWhere, createdAt: prev } }),
    db.sellerLead.count({ where: { ...sellerWhere, createdAt: cur } }),
    db.sellerLead.count({ where: { ...sellerWhere, createdAt: prev } }),
    db.vehicle.count({ where: { ...vehWhere, createdAt: cur } }),
    db.vehicle.count({ where: { ...vehWhere, createdAt: prev } }),
    db.offer.count({
      where: {
        createdAt: cur,
        ...(filter.agentId ? { buyerLead: { agentId: filter.agentId } } : {}),
      },
    }),
    db.offer.count({
      where: {
        createdAt: prev,
        ...(filter.agentId ? { buyerLead: { agentId: filter.agentId } } : {}),
      },
    }),
    db.offer.count({ where: reservationWhere(cur) }),
    db.offer.count({ where: reservationWhere(prev) }),
    db.activity.count({ where: salesWhere(cur) }),
    db.activity.count({ where: salesWhere(prev) }),
  ])

  return {
    range: { key: range.key, label: range.label },
    newBuyers: toKpi(newBuyersCur, newBuyersPrev),
    newSellers: toKpi(newSellersCur, newSellersPrev),
    capturedVehicles: toKpi(capturedCur, capturedPrev),
    offersCreated: toKpi(offersCur, offersPrev),
    newReservations: toKpi(reservationsCur, reservationsPrev),
    sales: toKpi(salesCur, salesPrev),
  }
}
