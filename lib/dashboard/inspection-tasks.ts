import type { Prisma } from '@prisma/client'
import { ACTIVE_WORKORDER_STATUSES } from '../entry/inspection-template'
import { vehicleLabel } from '../display'

export async function inspectionTasks(db: Prisma.TransactionClient, ownerId?: string) {
  const orders = await db.workOrder.findMany({
    where: {
      kind: 'INSPECCION_ENTRADA',
      status: { in: [...ACTIVE_WORKORDER_STATUSES] },
      assignedToId: ownerId,
      vehicle: {
        physicalArrivalAt: { not: null },
        entryAnnulledAt: null,
        sellerLead: { archivedAt: null },
      },
    },
    select: {
      id: true,
      assignedTo: { select: { name: true } },
      vehicle: { select: { brand: true, model: true, year: true, physicalArrivalAt: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  return orders.map((o) => ({
    href: '/taller/' + o.id + '#inspeccion-entrada',
    title: 'Inspeccionar ' + vehicleLabel(o.vehicle),
    context: 'Inspección de entrada',
    owner: o.assignedTo?.name ?? null,
    when: o.vehicle.physicalArrivalAt,
    label: 'Llegada confirmada',
  }))
}
