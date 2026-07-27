/**
 * A3 — Valoración PRELIMINAR (orientativa, antes de la entrada oficial).
 *
 * Sustituye a la antigua `runAndSaveAutoValuation`, que transicionaba CUALQUIER vehículo
 * `NUEVO → TASADO` y escribía los campos denormalizados oficiales al crear/actualizar. Ahora la
 * valoración automática al crear/actualizar es **preliminar**:
 *   · NUNCA cambia `Vehicle.status`;
 *   · NUNCA escribe los denormalizados oficiales `Vehicle.valuation*` (son del precio OFICIAL);
 *   · NUNCA habilita matching ni publicación;
 *   · SIEMPRE registra un `VehicleValuationAttempt` (purpose PRELIMINAR) — incluidos los intentos
 *     SIN_REFERENCIA y FALLO_TECNICO, que la versión anterior perdía;
 *   · si el intento es COMPLETADA, crea además una `Valuation` (purpose PRELIMINAR) como historial.
 *
 * NO bloquea el flujo principal: captura cualquier error y lo registra sin lanzar.
 * La transición `NUEVO → TASADO` pasa a ser consecuencia EXCLUSIVA de la tasación OFICIAL
 * (`lib/valuation/official`), gated por entrada activa + inspección COMPLETADA.
 */
import { db } from '@/lib/db'
import { calculateValuation } from './calculate'
import { prismaValuationDeps } from './prisma-deps'
import { referenceUsedLabel, resultToOutcome } from './outcome'
import type { ValuationVehicleInput, ValuationOutput } from './types'

/**
 * Calcula y registra una valoración PRELIMINAR del vehículo. Devuelve el `ValuationOutput` cuando el
 * cálculo se completa (para que, p. ej., `/vender/success` muestre el rango orientativo), o `null`
 * si hubo un fallo técnico. Nunca lanza.
 */
export async function runAndSavePreliminaryValuation(
  vehicleId: string,
  input: ValuationVehicleInput,
  actorId: string | null = null
): Promise<ValuationOutput | null> {
  let result: ValuationOutput
  try {
    result = await calculateValuation(input, prismaValuationDeps(db))
  } catch (err) {
    // FALLO_TECNICO: el cálculo lanzó (p. ej. error de BD). Se registra el intento y no se propaga.
    console.error('[valuation] Cálculo preliminar fallido para vehicle', vehicleId, err)
    await recordFailedPreliminaryAttempt(vehicleId, actorId, err)
    return null
  }

  const outcome = resultToOutcome(result)
  try {
    if (outcome === 'SIN_REFERENCIA') {
      await db.vehicleValuationAttempt.create({
        data: {
          vehicleId,
          purpose: 'PRELIMINAR',
          outcome: 'SIN_REFERENCIA',
          method: 'AUTO',
          createdById: actorId,
        },
      })
      return result
    }

    // COMPLETADA: historial (Valuation PRELIMINAR) + intento enlazado. NO denormalizado, NO estado.
    await db.$transaction(async (tx) => {
      const valuation = await tx.valuation.create({
        data: {
          vehicleId,
          min: result.min,
          recommended: result.recommended,
          max: result.max,
          method: 'AUTO',
          confidence: result.confidence,
          purpose: 'PRELIMINAR',
          parameters: result.parameters as object,
          createdById: actorId,
        },
      })
      await tx.vehicleValuationAttempt.create({
        data: {
          vehicleId,
          purpose: 'PRELIMINAR',
          outcome: 'COMPLETADA',
          method: 'AUTO',
          confidence: result.confidence,
          min: result.min,
          recommended: result.recommended,
          max: result.max,
          referenceUsed: referenceUsedLabel(result),
          createdById: actorId,
          valuationId: valuation.id,
        },
      })
    })
    return result
  } catch (err) {
    console.error('[valuation] Persistencia preliminar fallida para vehicle', vehicleId, err)
    return result
  }
}

/** Registra un intento preliminar FALLO_TECNICO (best-effort; nunca lanza). */
async function recordFailedPreliminaryAttempt(
  vehicleId: string,
  actorId: string | null,
  err: unknown
): Promise<void> {
  const errorCode = err instanceof Error ? err.name : 'UNKNOWN'
  try {
    await db.vehicleValuationAttempt.create({
      data: {
        vehicleId,
        purpose: 'PRELIMINAR',
        outcome: 'FALLO_TECNICO',
        method: 'AUTO',
        errorCode,
        createdById: actorId,
      },
    })
  } catch (persistErr) {
    console.error('[valuation] No se pudo registrar el intento fallido', vehicleId, persistErr)
  }
}
