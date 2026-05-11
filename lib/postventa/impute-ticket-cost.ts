import type { PrismaClient } from '@prisma/client'

/**
 * When a PostventaTicket is closed with costReal > 0, creates a VehicleCost
 * with category POSTVENTA. This reduces the vehicle's real margin retroactively.
 */
export async function imputeTicketCost(
  ticketId: string,
  actorId: string,
  db: PrismaClient
): Promise<void> {
  const ticket = await db.postventaTicket.findUnique({
    where: { id: ticketId },
    select: {
      costReal: true,
      title: true,
      warranty: { select: { vehicleId: true } },
    },
  })
  if (!ticket?.costReal || Number(ticket.costReal) <= 0) return

  await db.vehicleCost.create({
    data: {
      vehicleId: ticket.warranty.vehicleId,
      category: 'POSTVENTA',
      description: `Postventa: ${ticket.title}`,
      amount: ticket.costReal,
      createdById: actorId,
    },
  })
}
