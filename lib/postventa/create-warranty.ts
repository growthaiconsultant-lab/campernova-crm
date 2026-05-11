import type { PrismaClient } from '@prisma/client'

/**
 * Creates a Warranty + 2 PostventaFollowup (day 7 and day 30) for a completed
 * delivery. Called inside the same transaction that completes the delivery.
 */
export async function createWarrantyForDelivery(
  deliveryId: string,
  db: PrismaClient
): Promise<void> {
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
}
