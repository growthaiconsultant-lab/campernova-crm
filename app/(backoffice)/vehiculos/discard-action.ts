'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { withLockedRoots, isLockError } from '@/lib/locking'
import { buildVehicleUpdateRoots } from '@/lib/vehicle-status'
import { ACTIVE_DELIVERY_STATUSES, ACTIVE_OFFER_STATUSES } from '@/lib/lead-archiving/domain'
import { revalidatePublicCatalog } from '@/lib/revalidate-public-catalog'

const inputSchema = z.object({
  vehicleId: z.string().min(1),
  expectedStatus: z.enum(['NUEVO', 'TASADO', 'PUBLICADO']),
  reason: z.string().trim().max(500),
})

export async function discardInventoryVehicle(
  vehicleId: string,
  expectedStatus: string,
  reason: string
) {
  const actor = await requireAgente()
  const input = inputSchema.safeParse({ vehicleId, expectedStatus, reason })
  if (!input.success) return { error: 'Revisa el vehículo y el motivo (máximo 500 caracteres).' }
  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { error: 'Vehículo no encontrado.' }
  const roots = buildVehicleUpdateRoots({ vehicleId, sellerLeadId: vehicle.sellerLeadId })
  try {
    const error = await withLockedRoots(roots, async (tx) => {
      const current = await tx.vehicle.findUnique({
        where: { id: vehicleId },
        select: {
          status: true,
          sellerLeadId: true,
          sellerLead: { select: { archivedAt: true, intakeStatus: true } },
        },
      })
      if (
        !current ||
        current.sellerLeadId !== vehicle.sellerLeadId ||
        current.sellerLead.intakeStatus !== 'ADMITIDO' ||
        current.sellerLead.archivedAt
      )
        return 'El vehículo ya no pertenece a una ficha activa del inventario.'
      if (current.status === 'DESCARTADO') return null
      if (current.status === 'RESERVADO')
        return 'Resuelve la reserva desde Venta antes de descartar el vehículo.'
      if (current.status === 'VENDIDO') return 'La entrega ya está completada.'
      if (current.status !== expectedStatus)
        return 'El estado ha cambiado. Actualiza la tarjeta antes de confirmar el descarte.'
      if (await tx.offer.count({ where: { vehicleId, status: { in: ACTIVE_OFFER_STATUSES } } }))
        return 'Resuelve las ofertas activas desde Venta antes de descartar el vehículo.'
      if (
        await tx.delivery.count({ where: { vehicleId, status: { in: ACTIVE_DELIVERY_STATUSES } } })
      )
        return 'Resuelve la entrega en curso antes de descartar el vehículo.'
      const write = await tx.vehicle.updateMany({
        where: { id: vehicleId, status: current.status, sellerLeadId: vehicle.sellerLeadId },
        data: { status: 'DESCARTADO' },
      })
      if (write.count !== 1) return 'El vehículo ha cambiado. Actualiza el inventario.'
      await tx.activity.create({
        data: {
          type: 'CAMBIO_ESTADO',
          agentId: actor.id,
          sellerLeadId: vehicle.sellerLeadId,
          content:
            'Vehículo descartado.' + (input.data.reason ? ' Motivo: ' + input.data.reason : ''),
        },
      })
      return null
    })
    if (error) return { error }
  } catch (err) {
    if (isLockError(err)) return { error: err.message }
    throw err
  }
  revalidatePath('/vehiculos')
  revalidatePath('/vendedores')
  revalidatePath('/vendedores/' + vehicle.sellerLeadId)
  revalidatePublicCatalog()
  return { ok: true }
}
