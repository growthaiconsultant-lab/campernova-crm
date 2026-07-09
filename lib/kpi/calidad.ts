import type { PrismaClient, BuyerLeadStatus, VehicleStatus } from '@prisma/client'
import type { DashboardFilter } from '@/lib/dashboard/queries'
import { buyerCompleteness, vehicleCompleteness } from '@/lib/scoring/completeness'

/**
 * Bloque F6 KPIs — Dashboard Calidad de Datos. Garantiza que el CRM acumula
 * datos útiles: completitud media por entidad, entidades incompletas críticas y
 * trazabilidad de eventos. Lectura. Respeta el filtro de agente.
 */

const ACTIVE_BUYER: BuyerLeadStatus[] = ['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION']
const STOCK: VehicleStatus[] = ['NUEVO', 'TASADO', 'PUBLICADO', 'RESERVADO']

export type CalidadRow = { id: string; href: string; name: string; detail: string }
export type Avg = { label: string; pct: number }

export type CalidadKpis = {
  buyerAvg: number
  vehicleAvg: number
  eventTraceabilityPct: number
  criticalCount: number
  averages: Avg[]
  buyersNoBudget: number
  buyersNoAction: number
  vehiclesNoValuation: number
  salesNoMargin: number
  incompleteRows: CalidadRow[]
}

export async function getCalidadKpis(
  db: PrismaClient,
  filter: DashboardFilter
): Promise<CalidadKpis> {
  const buyerWhere = filter.agentId ? { agentId: filter.agentId } : {}
  const vehWhere = filter.agentId ? { sellerLead: { agentId: filter.agentId } } : {}

  const [buyers, vehicles, eventsTotal, eventsTraced, salesNoMargin] = await Promise.all([
    db.buyerLead.findMany({
      where: { ...buyerWhere, status: { in: ACTIVE_BUYER } },
      select: {
        id: true,
        name: true,
        maxBudget: true,
        vehicleType: true,
        purchaseTimeline: true,
        financingNeeded: true,
        useZone: true,
        minSeats: true,
        sleepingPlacesRequired: true,
        criticalEquipment: true,
        preferredCategory: true,
        preferredBedLayout: true,
        bathroomRequired: true,
        licenseType: true,
        maxLengthM: true,
        maxHeightM: true,
        nextActionType: true,
      },
    }),
    db.vehicle.findMany({
      where: { ...vehWhere, status: { in: STOCK } },
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        status: true,
        salePrice: true,
        desiredPrice: true,
        valuationRecommended: true,
        type: true,
        seats: true,
        sleepingPlaces: true,
        location: true,
        conservationState: true,
        equipment: true,
        sellerLead: { select: { id: true } },
        _count: { select: { documents: true, photos: true } },
      },
    }),
    db.kpiEvent.count(),
    db.kpiEvent.count({
      where: { OR: [{ actorUserId: { not: null } }, { source: { not: null } }] },
    }),
    db.vehicle.count({
      where: { ...vehWhere, status: 'VENDIDO', OR: [{ purchasePrice: null }, { salePrice: null }] },
    }),
  ])

  // Completitud media comprador
  const buyerScores = buyers.map((b) => {
    const eq = (b.criticalEquipment ?? {}) as Record<string, boolean>
    const hasMustHaves =
      Object.values(eq).some((v) => v === true) || !!b.preferredCategory || !!b.preferredBedLayout
    const hasDealBreakers =
      b.bathroomRequired === true || !!b.licenseType || b.maxLengthM != null || b.maxHeightM != null
    return buyerCompleteness({
      maxBudget: b.maxBudget ? Number(b.maxBudget) : null,
      vehicleType: b.vehicleType,
      purchaseTimeline: b.purchaseTimeline,
      financingNeeded: b.financingNeeded,
      useZone: b.useZone,
      minSeats: b.minSeats,
      sleepingPlacesRequired: b.sleepingPlacesRequired,
      hasMustHaves,
      hasDealBreakers,
      nextActionType: b.nextActionType,
    }).score
  })
  const buyerAvg = buyerScores.length
    ? Math.round(buyerScores.reduce((s, n) => s + n, 0) / buyerScores.length)
    : 0

  // Completitud media vehículo + incompletos
  const incompleteRows: CalidadRow[] = []
  const vehicleScores = vehicles.map((v) => {
    const eq = (v.equipment ?? {}) as Record<string, boolean>
    const score = vehicleCompleteness({
      hasBasics: true,
      price: v.salePrice ? Number(v.salePrice) : v.desiredPrice ? Number(v.desiredPrice) : null,
      type: v.type,
      seats: v.seats,
      sleepingPlaces: v.sleepingPlaces,
      location: v.location,
      conservationState: v.conservationState,
      hasEquipment: Object.values(eq).some((x) => x === true),
      hasDocs: v._count.documents > 0,
      photoCount: v._count.photos,
    }).score
    if (score < 70 && incompleteRows.length < 15) {
      incompleteRows.push({
        id: v.id,
        href: v.sellerLead ? `/vendedores/${v.sellerLead.id}` : '#',
        name: `${v.brand} ${v.model} ${v.year}`,
        detail: `Vehículo · ${score}% completo`,
      })
    }
    return score
  })
  const vehicleAvg = vehicleScores.length
    ? Math.round(vehicleScores.reduce((s, n) => s + n, 0) / vehicleScores.length)
    : 0

  const buyersNoBudget = buyers.filter((b) => b.maxBudget == null).length
  const buyersNoAction = buyers.filter((b) => b.nextActionType == null).length
  const vehiclesNoValuation = vehicles.filter(
    (v) => (v.status === 'TASADO' || v.status === 'PUBLICADO') && v.valuationRecommended == null
  ).length

  return {
    buyerAvg,
    vehicleAvg,
    eventTraceabilityPct: eventsTotal > 0 ? Math.round((eventsTraced / eventsTotal) * 100) : 100,
    criticalCount: buyersNoBudget + buyersNoAction + vehiclesNoValuation + salesNoMargin,
    averages: [
      { label: 'Compradores', pct: buyerAvg },
      { label: 'Vehículos', pct: vehicleAvg },
    ],
    buyersNoBudget,
    buyersNoAction,
    vehiclesNoValuation,
    salesNoMargin,
    incompleteRows,
  }
}
