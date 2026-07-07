import { RV_CATEGORY_OPTIONS, RV_BED_OPTIONS } from './rv-taxonomy'
import type { VehicleType, VehicleCategory, BedLayout, LicenseType } from '@prisma/client'

/**
 * CAM-65: clasifica los criterios de búsqueda de un comprador en
 * **excluyentes** (filtros duros del matching — descartan stock) vs
 * **preferencias** (ejes de scoring — puntúan pero no descartan).
 * La verdad de qué es duro vive en `lib/matching/filters.ts`; aquí se refleja.
 */
export type CriterionKind = 'excluyente' | 'preferencia'

export type BuyerCriterion = {
  label: string
  value: string
  kind: CriterionKind
}

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  RV_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
)
const BED_LABELS: Record<string, string> = Object.fromEntries(
  RV_BED_OPTIONS.map((o) => [o.value, o.label])
)

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  CAMPER: 'Camper',
  AUTOCARAVANA: 'Autocaravana',
}

const EQUIPMENT_LABELS: Record<string, string> = {
  solar: 'Placa solar',
  kitchen: 'Cocina',
  bathroom: 'Baño',
  shower: 'Ducha',
  heating: 'Calefacción',
}

export type BuyerCriteriaInput = {
  vehicleType: VehicleType | null
  minSeats: number | null
  maxBudget: number | string | null
  sleepingPlacesRequired: number | null
  bathroomRequired: boolean | null
  licenseType: LicenseType | null
  maxLengthM: number | null
  maxHeightM: number | null
  preferredCategory: VehicleCategory | null
  preferredBedLayout: BedLayout | null
  criticalEquipment: Record<string, boolean> | null
  useZone: string | null
  needsWinter: boolean | null
  needsGarage: boolean | null
  hasKids: boolean | null
}

function eur(n: number): string {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

/** Devuelve los criterios activos del comprador clasificados por tipo. */
export function classifyBuyerCriteria(b: BuyerCriteriaInput): BuyerCriterion[] {
  const out: BuyerCriterion[] = []
  const hard = (label: string, value: string) => out.push({ label, value, kind: 'excluyente' })
  const soft = (label: string, value: string) => out.push({ label, value, kind: 'preferencia' })

  // ── Excluyentes (filtros duros) ──
  if (b.vehicleType) hard('Tipo', VEHICLE_TYPE_LABELS[b.vehicleType] ?? b.vehicleType)
  if (b.minSeats != null) hard('Plazas mín.', `${b.minSeats}`)
  if (b.maxBudget != null) hard('Presupuesto', `≤ ${eur(Number(b.maxBudget))}`)
  if (b.sleepingPlacesRequired != null) hard('Plazas dormir', `${b.sleepingPlacesRequired}`)
  if (b.bathroomRequired === true) hard('Baño', 'obligatorio')
  if (b.licenseType === 'B') hard('Carnet', 'B (máx 3.500 kg)')
  if (b.maxLengthM != null) hard('Largo máx.', `${b.maxLengthM} m`)
  if (b.maxHeightM != null) hard('Alto máx.', `${b.maxHeightM} m`)

  // ── Preferencias (scoring) ──
  if (b.preferredCategory)
    soft('Distribución', CATEGORY_LABELS[b.preferredCategory] ?? b.preferredCategory)
  if (b.preferredBedLayout) soft('Cama', BED_LABELS[b.preferredBedLayout] ?? b.preferredBedLayout)
  if (b.criticalEquipment) {
    for (const [k, v] of Object.entries(b.criticalEquipment)) {
      if (v === true) soft('Equipo', EQUIPMENT_LABELS[k] ?? k)
    }
  }
  if (b.useZone && b.useZone.trim()) soft('Zona', b.useZone.trim())
  if (b.needsWinter === true) soft('Uso', 'invierno')
  if (b.needsGarage === true) soft('Garaje', 'sí')
  if (b.hasKids === true) soft('Viaja con', 'niños')

  return out
}
