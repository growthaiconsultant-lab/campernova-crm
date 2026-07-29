import type {
  VehicleType,
  VehicleCategory,
  BedLayout,
  BathroomType,
  LicenseType,
  VehicleStatus,
  BuyerLeadStatus,
} from '@prisma/client'
import type { EquipmentFlags } from '../valuation/types'

/// Datos mínimos de un vehículo para el matching.
/// `price` = `desiredPrice ?? valuationRecommended` (decidido en el adapter).
export type MatchingVehicleInput = {
  id: string
  // CAP-1: datos estructurales pueden faltar (captación progresiva) → null.
  type: VehicleType | null
  seats: number | null
  year: number | null
  km: number | null
  equipment: EquipmentFlags
  location: string | null
  price: number | null
  // Taxonomía RV (Fase #3 v1) — null = sin etiquetar
  category: VehicleCategory | null
  bedLayout: BedLayout | null
  sleepingPlaces: number | null
  bathroomType: BathroomType | null
  maxMassKg: number | null
  length: number | null
  heightM: number | null
  // Elegibilidad del SUJETO (M1 + A2) — el adapter real las rellena; opcionales para no
  // romper fixtures de scoring. El guard de find.ts solo actúa si `status` está definido.
  status?: VehicleStatus
  sellerArchivedAt?: Date | null
  // Entrada oficial (A2): elegible solo si validada y no anulada.
  entryValidatedAt?: Date | null
  entryAnnulledAt?: Date | null
}

/// Datos mínimos de un comprador para el matching.
export type MatchingBuyerInput = {
  id: string
  vehicleType: VehicleType | null
  minSeats: number | null
  maxBudget: number | null
  criticalEquipment: EquipmentFlags
  useZone: string | null
  // Preferencias (puntúan) y excluyentes (filtran) RV — null = sin preferencia
  preferredCategory: VehicleCategory | null
  preferredBedLayout: BedLayout | null
  sleepingPlacesRequired: number | null
  bathroomRequired: boolean | null
  licenseType: LicenseType | null
  maxLengthM: number | null
  maxHeightM: number | null
  // Elegibilidad del SUJETO (M1) — el adapter real las rellena; opcionales para no
  // romper fixtures de scoring. El guard de find.ts solo actúa si `status` está definido.
  status?: BuyerLeadStatus
  archivedAt?: Date | null
}

/// Desglose del score por eje (0-100 cada uno, antes de ponderar).
export type ScoreBreakdown = {
  category: number
  bedLayout: number
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

// Pesos v1 (suman 100). Distribución y cama mandan: son lo que más decide la compra.
export const WEIGHTS = {
  category: 22,
  bedLayout: 18,
  price: 20,
  equipment: 15,
  ageKm: 15,
  zone: 10,
} as const

export const TOP_N = 10
