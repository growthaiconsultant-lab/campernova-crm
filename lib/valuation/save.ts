import { db } from '@/lib/db'
import { calculateValuation } from './calculate'
import { prismaValuationDeps } from './prisma-deps'
import type { ValuationVehicleInput, ValuationOutput } from './types'
import type { ValuationMethod } from '@prisma/client'

/// Persiste un resultado de tasación ya calculado.
/// Si method es 'NONE' (sin datos suficientes) no guarda nada.
export async function persistValuation(
  vehicleId: string,
  result: ValuationOutput,
  method: ValuationMethod,
  actorId?: string | null
): Promise<void> {
  if (result.method === 'NONE') return

  // Crea la fila de histórico + actualiza los campos denormalizados del vehículo
  await db.$transaction([
    db.valuation.create({
      data: {
        vehicleId,
        min: result.min,
        recommended: result.recommended,
        max: result.max,
        method,
        confidence: result.confidence,
        parameters: result.parameters as object,
        createdById: actorId ?? null,
      },
    }),
    db.vehicle.update({
      where: { id: vehicleId },
      data: {
        valuationMin: result.min,
        valuationRecommended: result.recommended,
        valuationMax: result.max,
      },
    }),
  ])

  // Avanza NUEVO → TASADO si el vehículo todavía no tiene estado posterior
  await db.vehicle.updateMany({
    where: { id: vehicleId, status: 'NUEVO' },
    data: { status: 'TASADO' },
  })
}

/// Calcula y guarda automáticamente la tasación de un vehículo.
/// Captura errores para que un fallo de tasación no rompa el flujo principal.
export async function runAndSaveAutoValuation(
  vehicleId: string,
  input: ValuationVehicleInput
): Promise<ValuationOutput | null> {
  try {
    const result = await calculateValuation(input, prismaValuationDeps(db))
    await persistValuation(vehicleId, result, 'AUTO', null)
    return result
  } catch (err) {
    console.error('[valuation] Auto-tasación fallida para vehicle', vehicleId, err)
    return null
  }
}
