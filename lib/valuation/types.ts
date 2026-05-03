import type { ConservationState, VehicleType } from '@prisma/client'

export type EquipmentFlags = {
  solar?: boolean
  kitchen?: boolean
  bathroom?: boolean
  shower?: boolean
  heating?: boolean
}

/// Datos mínimos de un vehículo para tasarlo.
export type ValuationVehicleInput = {
  brand: string
  model: string
  type: VehicleType
  year: number
  km: number
  conservationState: ConservationState
  equipment: EquipmentFlags
}

/// Comparable interno: un vehículo vendido con un precio asociado.
export type ComparableSale = {
  id: string
  year: number
  km: number
  price: number
}

/// Fila de la tabla `reference_prices` necesaria para el fallback.
export type ReferencePriceData = {
  brand: string
  model: string
  type: VehicleType
  baseYear: number
  basePrice: number
  depreciationPerKm: number
}

/// Dependencias inyectables (DB-agnostic) — facilitan los unit tests.
export type ValuationDeps = {
  /// Devuelve vehículos vendidos similares: misma marca+modelo+tipo, año±2, km±20%.
  findComparables: (input: ValuationVehicleInput) => Promise<ComparableSale[]>
  /// Devuelve la entrada de reference_prices más cercana (por baseYear) para el modelo.
  findReferencePrice: (input: ValuationVehicleInput) => Promise<ReferencePriceData | null>
}

export type AlgorithmMethod = 'COMPARABLES' | 'REFERENCIA' | 'NONE'
export type Confidence = 'ALTA' | 'MEDIA' | 'BAJA'

/// Resultado de la tasación. Si method = 'NONE', el algoritmo no pudo tasar
/// (sin comparables y sin referencia) y `min/recommended/max` son 0.
export type ValuationOutput = {
  min: number
  recommended: number
  max: number
  method: AlgorithmMethod
  confidence: Confidence
  parameters: ValuationParameters
}

/// Auditoría: lo que entró al algoritmo + cómo se calculó. Persistido en
/// `valuations.parameters` (JSONB).
export type ValuationParameters = {
  input: ValuationVehicleInput
  method: AlgorithmMethod
  comparablesCount: number
  reference?: ReferencePriceData | null
  rawRange?: { min: number; recommended: number; max: number }
  adjustments: {
    conservationFactor: number
    equipmentFactor: number
    yearFactor?: number
  }
}
