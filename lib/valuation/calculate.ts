import { conservationFactor, equipmentFactor, yearFactor } from './adjustments'
import type {
  ComparableSale,
  Confidence,
  ReferencePriceData,
  ValuationDeps,
  ValuationOutput,
  ValuationVehicleInput,
} from './types'

const COMPARABLES_REQUIRED = 3
const REFERENCE_RANGE_PCT = 0.15
const ROUND_TO = 100

function roundTo(value: number, step = ROUND_TO): number {
  return Math.round(value / step) * step
}

function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0
  if (sortedAsc.length === 1) return sortedAsc[0]
  const pos = (sortedAsc.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sortedAsc[base + 1]
  if (next === undefined) return sortedAsc[base]
  return sortedAsc[base] + rest * (next - sortedAsc[base])
}

function computeFromComparables(comparables: ComparableSale[]) {
  const prices = comparables.map((c) => c.price).sort((a, b) => a - b)
  return {
    min: quantile(prices, 0.25),
    recommended: quantile(prices, 0.5),
    max: quantile(prices, 0.75),
  }
}

function computeFromReference(
  reference: ReferencePriceData,
  input: ValuationVehicleInput
): { min: number; recommended: number; max: number; yearFactor: number } {
  const yf = yearFactor(input.year, reference.baseYear)
  const adjustedBase = reference.basePrice * yf
  const kmDepreciation = input.km * reference.depreciationPerKm
  const recommended = Math.max(adjustedBase - kmDepreciation, 0)
  return {
    min: recommended * (1 - REFERENCE_RANGE_PCT),
    recommended,
    max: recommended * (1 + REFERENCE_RANGE_PCT),
    yearFactor: yf,
  }
}

function comparableConfidence(count: number): Confidence {
  if (count >= 5) return 'ALTA'
  return 'MEDIA'
}

function referenceConfidence(
  input: ValuationVehicleInput,
  reference: ReferencePriceData
): Confidence {
  return Math.abs(input.year - reference.baseYear) <= 1 ? 'MEDIA' : 'BAJA'
}

/// Tasación de un vehículo. Busca primero comparables internos (≥3 vendidos),
/// y si no hay suficientes cae a la tabla de referencia. Aplica ajustes por
/// estado de conservación y equipamiento premium al rango calculado.
export async function calculateValuation(
  input: ValuationVehicleInput,
  deps: ValuationDeps
): Promise<ValuationOutput> {
  const comparables = await deps.findComparables(input)

  const conservation = conservationFactor(input.conservationState)
  const equipment = equipmentFactor(input.equipment)
  const adjustmentFactor = conservation * equipment

  if (comparables.length >= COMPARABLES_REQUIRED) {
    const raw = computeFromComparables(comparables)
    return {
      min: roundTo(raw.min * adjustmentFactor),
      recommended: roundTo(raw.recommended * adjustmentFactor),
      max: roundTo(raw.max * adjustmentFactor),
      method: 'COMPARABLES',
      confidence: comparableConfidence(comparables.length),
      parameters: {
        input,
        method: 'COMPARABLES',
        comparablesCount: comparables.length,
        rawRange: raw,
        adjustments: {
          conservationFactor: conservation,
          equipmentFactor: equipment,
        },
      },
    }
  }

  const reference = await deps.findReferencePrice(input)
  if (reference) {
    const raw = computeFromReference(reference, input)
    return {
      min: roundTo(raw.min * adjustmentFactor),
      recommended: roundTo(raw.recommended * adjustmentFactor),
      max: roundTo(raw.max * adjustmentFactor),
      method: 'REFERENCIA',
      confidence: referenceConfidence(input, reference),
      parameters: {
        input,
        method: 'REFERENCIA',
        comparablesCount: comparables.length,
        reference,
        rawRange: { min: raw.min, recommended: raw.recommended, max: raw.max },
        adjustments: {
          conservationFactor: conservation,
          equipmentFactor: equipment,
          yearFactor: raw.yearFactor,
        },
      },
    }
  }

  return {
    min: 0,
    recommended: 0,
    max: 0,
    method: 'NONE',
    confidence: 'BAJA',
    parameters: {
      input,
      method: 'NONE',
      comparablesCount: comparables.length,
      reference: null,
      adjustments: {
        conservationFactor: conservation,
        equipmentFactor: equipment,
      },
    },
  }
}
