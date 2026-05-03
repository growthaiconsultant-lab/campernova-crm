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

  return true
}
