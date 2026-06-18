import type { MatchingBuyerInput, MatchingVehicleInput } from './types'

const BUDGET_TOLERANCE = 1.1

/// Filtros duros: tipo, plazas mínimas y precio dentro del presupuesto +10%.
/// Si el comprador no especifica un criterio, ese filtro pasa automáticamente.
/// Si el comprador exige presupuesto pero el vehículo no tiene precio conocido,
/// el match se descarta.
export function passesHardFilters(
  vehicle: MatchingVehicleInput,
  buyer: MatchingBuyerInput
): boolean {
  if (buyer.vehicleType !== null && vehicle.type !== buyer.vehicleType) {
    return false
  }

  if (buyer.minSeats !== null && vehicle.seats < buyer.minSeats) {
    return false
  }

  if (buyer.maxBudget !== null) {
    if (vehicle.price === null) return false
    if (vehicle.price > buyer.maxBudget * BUDGET_TOLERANCE) return false
  }

  // ── Filtros RV (Fase #3 v1) ──
  // Política: si el comprador no lo exige, pasa; si el vehículo no tiene el dato
  // (stock sin etiquetar), NO se descarta (fail-open) para no ocultar inventario.

  // Plazas para dormir: el vehículo debe dormir al menos las requeridas.
  if (
    buyer.sleepingPlacesRequired !== null &&
    vehicle.sleepingPlaces !== null &&
    vehicle.sleepingPlaces < buyer.sleepingPlacesRequired
  ) {
    return false
  }

  // Carnet B: no puede conducir vehículos de MMA > 3.500 kg.
  if (buyer.licenseType === 'B' && vehicle.maxMassKg !== null && vehicle.maxMassKg > 3500) {
    return false
  }

  // Baño obligatorio: descarta si el vehículo NO tiene baño.
  if (buyer.bathroomRequired === true && vehicle.bathroomType === 'NINGUNO') {
    return false
  }

  // Restricción de parking: largo y alto máximos.
  if (buyer.maxLengthM !== null && vehicle.length !== null && vehicle.length > buyer.maxLengthM) {
    return false
  }
  if (buyer.maxHeightM !== null && vehicle.heightM !== null && vehicle.heightM > buyer.maxHeightM) {
    return false
  }

  return true
}
