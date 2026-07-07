import type { PrismaClient } from '@prisma/client'
import type {
  CalendarDeps,
  DeliveryRow,
  EventRow,
  FollowupRow,
  NextActionRow,
  WorkOrderRow,
} from './aggregate'

const SELLER_ACTIVE = { notIn: ['CERRADO', 'DESCARTADO'] as ('CERRADO' | 'DESCARTADO')[] }
const BUYER_ACTIVE = { notIn: ['CERRADO', 'PERDIDO'] as ('CERRADO' | 'PERDIDO')[] }

/** Adapter real de las deps del calendario con Prisma. */
export function prismaCalendarDeps(db: PrismaClient): CalendarDeps {
  return {
    async listDeliveries(from, to): Promise<DeliveryRow[]> {
      return db.delivery.findMany({
        where: { scheduledAt: { gte: from, lt: to } },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          vehicle: { select: { brand: true, model: true } },
          buyerLead: { select: { name: true } },
          responsable: { select: { id: true, name: true } },
        },
      })
    },

    async listWorkOrders(from, to): Promise<WorkOrderRow[]> {
      // Solapa la ventana si empieza antes de `to` y termina (o empieza) en/después de `from`.
      const rows = await db.workOrder.findMany({
        where: {
          scheduledStart: { not: null, lt: to },
          OR: [
            { scheduledEnd: { gte: from } },
            { scheduledEnd: null, scheduledStart: { gte: from } },
          ],
        },
        select: {
          id: true,
          scheduledStart: true,
          scheduledEnd: true,
          status: true,
          description: true,
          vehicle: { select: { brand: true, model: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      })
      // scheduledStart es non-null por el filtro; lo afirmamos para el tipo.
      return rows.map((r) => ({ ...r, scheduledStart: r.scheduledStart as Date }))
    },

    async listFollowups(from, to): Promise<FollowupRow[]> {
      return db.postventaFollowup.findMany({
        where: { scheduledFor: { gte: from, lt: to } },
        select: {
          id: true,
          scheduledFor: true,
          type: true,
          status: true,
          warrantyId: true,
        },
      })
    },

    async listNextActions(from, to): Promise<NextActionRow[]> {
      const range = { gte: from, lt: to }
      const [sellers, buyers] = await Promise.all([
        db.sellerLead.findMany({
          where: {
            status: SELLER_ACTIVE,
            nextActionType: { not: null },
            nextActionDueAt: range,
          },
          select: {
            id: true,
            name: true,
            nextActionType: true,
            nextActionDueAt: true,
            agent: { select: { id: true, name: true } },
          },
        }),
        db.buyerLead.findMany({
          where: {
            status: BUYER_ACTIVE,
            nextActionType: { not: null },
            nextActionDueAt: range,
          },
          select: {
            id: true,
            name: true,
            nextActionType: true,
            nextActionDueAt: true,
            agent: { select: { id: true, name: true } },
          },
        }),
      ])

      const mapRow =
        (leadKind: 'seller' | 'buyer') =>
        (r: (typeof sellers)[number]): NextActionRow => ({
          id: r.id,
          leadKind,
          name: r.name,
          nextActionType: r.nextActionType!,
          nextActionDueAt: r.nextActionDueAt!,
          agent: r.agent,
        })

      return [...sellers.map(mapRow('seller')), ...buyers.map(mapRow('buyer'))]
    },

    async listEvents(from, to): Promise<EventRow[]> {
      return db.calendarEvent.findMany({
        where: { startAt: { gte: from, lt: to } },
        select: {
          id: true,
          type: true,
          title: true,
          status: true,
          startAt: true,
          endAt: true,
          allDay: true,
          assignedTo: { select: { id: true, name: true } },
          buyerLead: { select: { name: true } },
          sellerLead: { select: { name: true } },
          vehicle: { select: { brand: true, model: true } },
        },
      })
    },
  }
}
