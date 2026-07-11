import type { Prisma } from '@prisma/client'

/** Semilla de test para forzar un fallo determinista entre la garantía y los seguimientos. */
export type CreateWarrantyHooks = { beforeFollowupsWrite?: () => Promise<void> }

/**
 * Crea la Warranty + 2 PostventaFollowup (día 7 y día 30) de una entrega completada.
 * Debe ejecutarse DENTRO de la transacción que completa la entrega (acepta un
 * `Prisma.TransactionClient`), de modo que un fallo en los seguimientos revierta también
 * la garantía. La unicidad la garantiza el esquema: `Warranty.deliveryId/vehicleId/
 * buyerLeadId @unique` (una garantía por entrega) y `PostventaFollowup @@unique([warrantyId,
 * type])` (un seguimiento por tipo) → un reintento no puede duplicar registros.
 */
export async function createWarrantyForDelivery(
  deliveryId: string,
  db: Prisma.TransactionClient,
  hooks: CreateWarrantyHooks = {}
): Promise<{ warrantyId: string }> {
  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    select: { vehicleId: true, buyerLeadId: true, completedAt: true },
  })
  if (!delivery?.completedAt) throw new Error('Delivery not completed')

  const startDate = delivery.completedAt
  const endDate = new Date(startDate)
  endDate.setFullYear(endDate.getFullYear() + 1)

  const warranty = await db.warranty.create({
    data: {
      vehicleId: delivery.vehicleId,
      deliveryId,
      buyerLeadId: delivery.buyerLeadId,
      startDate,
      endDate,
    },
  })

  // Punto de fallo determinista para tests (entre garantía y seguimientos); no-op en producción.
  await hooks.beforeFollowupsWrite?.()

  const day7 = new Date(startDate)
  day7.setDate(day7.getDate() + 7)

  const day30 = new Date(startDate)
  day30.setDate(day30.getDate() + 30)

  await db.postventaFollowup.createMany({
    data: [
      { warrantyId: warranty.id, type: 'DIA_7', scheduledFor: day7 },
      { warrantyId: warranty.id, type: 'DIA_30', scheduledFor: day30 },
    ],
  })

  return { warrantyId: warranty.id }
}
