/**
 * A3 — Mapeo puro entre el resultado del algoritmo y el `outcome` de un intento de valoración,
 * más la validación de una tasación manual. Sin Prisma, sin efectos: 100% testable.
 */
import type { ValuationConfidence, ValuationOutcome } from '@prisma/client'
import type { ValuationOutput } from './types'

/**
 * Traduce el resultado del algoritmo a un `ValuationOutcome`:
 *   · `method === 'NONE'` (sin comparables ni referencia) → `SIN_REFERENCIA` (sin cifras);
 *   · cualquier otro método con cifras → `COMPLETADA`.
 * El caso `FALLO_TECNICO` NO nace aquí: corresponde a una excepción al calcular y lo decide el
 * escritor (el algoritmo no lanza por falta de datos, devuelve `NONE`).
 */
export function resultToOutcome(result: ValuationOutput): ValuationOutcome {
  return result.method === 'NONE' ? 'SIN_REFERENCIA' : 'COMPLETADA'
}

/** Resumen legible de la base de cálculo usada (para `reference_used`). `null` si no aplica. */
export function referenceUsedLabel(result: ValuationOutput): string | null {
  const p = result.parameters
  if (p.method === 'COMPARABLES') return `COMPARABLES · ${p.comparablesCount} ventas`
  if (p.method === 'REFERENCIA' && p.reference) {
    return `REFERENCIA · ${p.reference.brand} ${p.reference.model} (base ${p.reference.baseYear})`
  }
  return null
}

export type ManualValuationInput = {
  min: number
  recommended: number
  max: number
  confidence: ValuationConfidence
  reason: string
}

/** Códigos de validación de una tasación manual (subconjunto de `ValuationErrorCode`). */
export type ManualValidationError =
  | 'INVALID_RANGE'
  | 'NEGATIVE_MONEY'
  | 'CONFIDENCE_REQUIRED'
  | 'REASON_REQUIRED'

const CONFIDENCES: readonly ValuationConfidence[] = ['ALTA', 'MEDIA', 'BAJA']

/**
 * Valida una tasación manual OFICIAL. Reglas: dinero no negativo, `min <= recommended <= max`,
 * confianza declarada explícitamente (NUNCA se infiere `ALTA`), motivo estructurado presente.
 * Devuelve el primer error o `null` si es válida.
 */
export function validateManualValuation(input: ManualValuationInput): ManualValidationError | null {
  const nums = [input.min, input.recommended, input.max]
  if (!nums.every((n) => Number.isFinite(n))) return 'INVALID_RANGE'
  if (nums.some((n) => n < 0)) return 'NEGATIVE_MONEY'
  if (!(input.min <= input.recommended && input.recommended <= input.max)) return 'INVALID_RANGE'
  if (!CONFIDENCES.includes(input.confidence)) return 'CONFIDENCE_REQUIRED'
  if (input.reason.trim().length === 0) return 'REASON_REQUIRED'
  return null
}
