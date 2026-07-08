import type { ScoreItem, ScoreResult } from './buyer'

/**
 * Bloque F0 KPIs — Completeness scores (calidad de ficha) con los pesos del
 * spec (§7 B1, §9 V2). Puro y en lectura. El `operationCompleteness` (North
 * Star) mide si una operación está "estructurada": comprador+vehículo con
 * ficha ≥70, valoración, ≥1 match, workflow y próxima acción.
 */

export const STRUCTURED_THRESHOLD = 70

function build(items: ScoreItem[]): ScoreResult {
  const score = Math.round(items.reduce((s, i) => s + i.points, 0))
  return { score: Math.min(100, score), breakdown: items }
}

// ── Comprador (total 100) ──
export type BuyerCompletenessInput = {
  maxBudget: number | null
  vehicleType: string | null
  purchaseTimeline: string | null // urgencia
  financingNeeded: boolean | null
  useZone: string | null
  minSeats: number | null
  sleepingPlacesRequired: number | null
  hasMustHaves: boolean // equipamiento crítico o distribución/cama preferida
  hasDealBreakers: boolean // baño oblig. / carnet / medidas
  nextActionType: string | null
}

export function buyerCompleteness(b: BuyerCompletenessInput): ScoreResult {
  return build([
    { label: 'Presupuesto', points: b.maxBudget != null ? 20 : 0, max: 20 },
    { label: 'Tipo de vehículo', points: b.vehicleType ? 15 : 0, max: 15 },
    { label: 'Urgencia / plazo', points: b.purchaseTimeline ? 10 : 0, max: 10 },
    { label: 'Financiación', points: b.financingNeeded != null ? 10 : 0, max: 10 },
    { label: 'Ubicación', points: b.useZone ? 10 : 0, max: 10 },
    { label: 'Plazas de viaje', points: b.minSeats != null ? 10 : 0, max: 10 },
    { label: 'Plazas para dormir', points: b.sleepingPlacesRequired != null ? 10 : 0, max: 10 },
    { label: 'Must-haves', points: b.hasMustHaves ? 10 : 0, max: 10 },
    { label: 'Deal-breakers', points: b.hasDealBreakers ? 5 : 0, max: 5 },
  ])
}

// ── Vendedor (total 100) ──
export type SellerCompletenessInput = {
  hasVehicleBasics: boolean // marca/modelo/año/km
  desiredPrice: number | null
  minPrice: number | null
  location: string | null
  urgency: string | null // B17
  dealType: string | null // B17
  riskAssessed: boolean // riskLevel definido
  hasDocs: boolean // al menos 1 documento
  hasPhotos: boolean
  nextActionType: string | null
}

export function sellerCompleteness(s: SellerCompletenessInput): ScoreResult {
  return build([
    { label: 'Datos del vehículo', points: s.hasVehicleBasics ? 20 : 0, max: 20 },
    { label: 'Precio esperado', points: s.desiredPrice != null ? 15 : 0, max: 15 },
    { label: 'Precio mínimo', points: s.minPrice != null ? 5 : 0, max: 5 },
    { label: 'Ubicación', points: s.location ? 10 : 0, max: 10 },
    { label: 'Urgencia', points: s.urgency ? 10 : 0, max: 10 },
    { label: 'Modalidad de acuerdo', points: s.dealType ? 10 : 0, max: 10 },
    { label: 'Riesgo evaluado', points: s.riskAssessed ? 10 : 0, max: 10 },
    { label: 'Documentación', points: s.hasDocs ? 10 : 0, max: 10 },
    { label: 'Fotos', points: s.hasPhotos ? 5 : 0, max: 5 },
    { label: 'Próxima acción', points: s.nextActionType ? 5 : 0, max: 5 },
  ])
}

// ── Vehículo (total 100, pesos spec §9 V2) ──
export type VehicleCompletenessInput = {
  hasBasics: boolean // marca/modelo/año/km
  price: number | null // salePrice o desiredPrice
  type: string | null
  seats: number | null
  sleepingPlaces: number | null
  location: string | null
  conservationState: string | null
  hasEquipment: boolean
  hasDocs: boolean
  photoCount: number
}

export function vehicleCompleteness(v: VehicleCompletenessInput): ScoreResult {
  const seatsPts = (v.seats != null ? 5 : 0) + (v.sleepingPlaces != null ? 5 : 0)
  return build([
    { label: 'Marca/modelo/año/km', points: v.hasBasics ? 20 : 0, max: 20 },
    { label: 'Precio', points: v.price != null ? 15 : 0, max: 15 },
    { label: 'Tipo', points: v.type ? 10 : 0, max: 10 },
    { label: 'Plazas viaje/dormir', points: seatsPts, max: 10 },
    { label: 'Ubicación', points: v.location ? 10 : 0, max: 10 },
    { label: 'Estado general', points: v.conservationState ? 10 : 0, max: 10 },
    { label: 'Equipamiento clave', points: v.hasEquipment ? 10 : 0, max: 10 },
    { label: 'Documentación mínima', points: v.hasDocs ? 10 : 0, max: 10 },
    { label: 'Fotos', points: v.photoCount > 0 ? 5 : 0, max: 5 },
  ])
}

// ── Operación estructurada (North Star) ──
export type OperationCompletenessInput = {
  buyerScore: number
  vehicleScore: number
  hasValuation: boolean
  hasMatch: boolean
  hasWorkflowStatus: boolean
  hasNextAction: boolean
}

export type OperationStructure = {
  isStructured: boolean
  missing: string[]
}

/**
 * Una operación es "estructurada" si cumple TODOS los gates del North Star.
 * Devuelve qué falta para poder mostrar el drill-down "datos faltantes".
 */
export function operationStructure(o: OperationCompletenessInput): OperationStructure {
  const missing: string[] = []
  if (o.buyerScore < STRUCTURED_THRESHOLD) missing.push('Ficha de comprador incompleta')
  if (o.vehicleScore < STRUCTURED_THRESHOLD) missing.push('Ficha de vehículo incompleta')
  if (!o.hasValuation) missing.push('Sin valoración')
  if (!o.hasMatch) missing.push('Sin match')
  if (!o.hasWorkflowStatus) missing.push('Sin estado de workflow')
  if (!o.hasNextAction) missing.push('Sin próxima acción')
  return { isStructured: missing.length === 0, missing }
}
