import type { VehicleType } from '@prisma/client'
import type { EquipmentFlags } from '../valuation/types'

/// Datos mínimos de un vehículo para el matching.
/// `price` = `desiredPrice ?? valuationRecommended` (decidido en el adapter).
export type MatchingVehicleInput = {
  id: string
  type: VehicleType
  seats: number
  year: number
  km: number
  equipment: EquipmentFlags
  location: string | null
  price: number | null
}

/// Datos mínimos de un comprador para el matching.
export type MatchingBuyerInput = {
  id: string
  vehicleType: VehicleType | null
  minSeats: number | null
  maxBudget: number | null
  criticalEquipment: EquipmentFlags
  useZone: string | null
}

/// Desglose del score por eje (0-100 cada uno, antes de ponderar).
export type ScoreBreakdown = {
  equipment: number
  price: number
  ageKm: number
  zone: number
}

/// Match con score final (0-100) y desglose para auditoría/UI.
export type ScoredMatch = {
  vehicleId: string
  buyerLeadId: string
  score: number
  breakdown: ScoreBreakdown
}

/// Dependencias inyectables (DB-agnostic) — facilitan los unit tests.
export type MatchingDeps = {
  /// Devuelve los datos de matching del vehículo, o null si no existe.
  getVehicle: (vehicleId: string) => Promise<MatchingVehicleInput | null>
  /// Devuelve los datos de matching del comprador, o null si no existe.
  getBuyer: (buyerLeadId: string) => Promise<MatchingBuyerInput | null>
  /// Lista vehículos elegibles (PUBLICADO o TASADO).
  listEligibleVehicles: () => Promise<MatchingVehicleInput[]>
  /// Lista compradores elegibles (status distinto de CERRADO/PERDIDO).
  listEligibleBuyers: () => Promise<MatchingBuyerInput[]>
}

export const WEIGHTS = {
  equipment: 40,
  price: 25,
  ageKm: 20,
  zone: 15,
} as const

export const TOP_N = 10
