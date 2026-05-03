import type { EquipmentFlags } from '../valuation/types'

const PRICE_SWEET_SPOT = 0.9
const PRICE_FILTER_CAP = 1.1
const KM_FLOOR = 200_000
const AGE_FLOOR_YEARS = 15

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalize(text: string): string {
  return text.trim().toLowerCase()
}

/// Equipamiento crítico: % de items pedidos por el comprador que tiene el vehículo.
/// Si el comprador no exige ningún equipo → 100 (no hay nada que validar).
export function scoreEquipment(
  vehicleEquipment: EquipmentFlags,
  buyerCritical: EquipmentFlags
): number {
  const required = (Object.keys(buyerCritical) as Array<keyof EquipmentFlags>).filter(
    (key) => buyerCritical[key] === true
  )

  if (required.length === 0) return 100

  const matched = required.filter((key) => vehicleEquipment[key] === true).length
  return Math.round((matched / required.length) * 100)
}

/// Precio: 100 si ≤90% del presupuesto, decae lineal a 0 al llegar a +10%.
/// Sin presupuesto definido → 100 (no hay restricción que castigar).
/// Sin precio en el vehículo → 50 (neutral; el filtro duro ya descartó si era exigible).
export function scorePrice(vehiclePrice: number | null, maxBudget: number | null): number {
  if (maxBudget === null) return 100
  if (vehiclePrice === null) return 50

  const ratio = vehiclePrice / maxBudget
  if (ratio <= PRICE_SWEET_SPOT) return 100
  if (ratio >= PRICE_FILTER_CAP) return 0

  const range = PRICE_FILTER_CAP - PRICE_SWEET_SPOT
  const overshoot = ratio - PRICE_SWEET_SPOT
  return Math.round((1 - overshoot / range) * 100)
}

/// Antigüedad + km: media de dos componentes lineales.
/// Año: 100 si current year, 0 si ≥15 años de antigüedad.
/// Km: 100 si 0 km, 0 si ≥200.000 km.
export function scoreAgeKm(year: number, km: number, nowYear: number): number {
  const age = Math.max(0, nowYear - year)
  const ageScore = clamp(1 - age / AGE_FLOOR_YEARS, 0, 1) * 100
  const kmScore = clamp(1 - km / KM_FLOOR, 0, 1) * 100
  return Math.round((ageScore + kmScore) / 2)
}

/// Zona: match exacto case-insensitive con trim.
/// Sin preferencia del comprador → 100 (cualquier zona vale).
/// Vehículo sin ubicación pero comprador la pide → 0.
export function scoreZone(vehicleLocation: string | null, buyerZone: string | null): number {
  if (buyerZone === null || normalize(buyerZone) === '') return 100
  if (vehicleLocation === null || normalize(vehicleLocation) === '') return 0
  return normalize(vehicleLocation) === normalize(buyerZone) ? 100 : 0
}
