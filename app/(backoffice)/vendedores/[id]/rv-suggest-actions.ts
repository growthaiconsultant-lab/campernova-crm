'use server'

import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { suggestRvTaxonomy, type RvSuggestResult } from '@/lib/rv-suggest/suggest'

/**
 * Sugiere la ficha técnica RV de un vehículo con IA (visión sobre sus fotos + datos conocidos).
 * NO persiste nada: devuelve la propuesta para que el agente la revise y guarde con el form.
 */
export async function suggestVehicleRvTaxonomy(
  vehicleId: string
): Promise<{ suggestion: RvSuggestResult['suggestion'] } | { error: string }> {
  await requireAgente()

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      brand: true,
      model: true,
      year: true,
      km: true,
      type: true,
      seats: true,
      conservationState: true,
      length: true,
      photos: { orderBy: { order: 'asc' }, select: { url: true } },
    },
  })
  if (!vehicle) return { error: 'Vehículo no encontrado' }

  if (vehicle.photos.length === 0) {
    return { error: 'Sube al menos una foto del vehículo para que la IA pueda analizarlo.' }
  }

  try {
    const result = await suggestRvTaxonomy(
      {
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        km: vehicle.km,
        type: vehicle.type,
        seats: vehicle.seats,
        conservationState: vehicle.conservationState,
        length: vehicle.length,
      },
      vehicle.photos.map((p) => p.url)
    )
    return { suggestion: result.suggestion }
  } catch (err) {
    console.error('[rv-suggest] suggestRvTaxonomy failed:', err)
    return { error: 'No se pudo generar la sugerencia. Inténtalo de nuevo.' }
  }
}
