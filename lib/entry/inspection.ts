import type { Prisma } from '@prisma/client'
import { INSPECTION_CHECKLIST, ACTIVE_WORKORDER_STATUSES } from './inspection-template'
import { initialEquipment } from './inspection-equipment'
import { inspectionCoordinator } from './inspection-coordinator'

// Caller holds the Vehicle and SellerLead root locks for both arrival and validation.
export async function ensureEntryInspection(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  sellerLeadId: string,
  actorId: string,
  handoff: 'arrival' | 'retry' | 'none'
) {
  const where = { vehicleId, kind: 'INSPECCION_ENTRADA' as const }
  const select = { id: true, assignedToId: true, status: true } as const
  const active = await tx.workOrder.findFirst({
    where: { ...where, status: { in: [...ACTIVE_WORKORDER_STATUSES] } },
    select,
  })
  const existing =
    active ??
    (await tx.workOrder.findFirst({
      where,
      select,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    }))
  if (existing && (handoff === 'none' || (handoff === 'retry' && existing.assignedToId) || !active))
    return existing
  const coordinator = handoff !== 'none' ? await inspectionCoordinator(tx) : null
  if (existing) {
    if (!coordinator) return existing
    return tx.workOrder.update({
      where: { id: existing.id },
      data: { assignedToId: coordinator.id },
      select,
    })
  }
  const vehicle = await tx.vehicle.findUniqueOrThrow({
    where: { id: vehicleId },
    select: { equipment: true, matchCatalog: true, heatingType: true },
  })
  const order = await tx.workOrder.create({
    data: {
      vehicleId,
      kind: 'INSPECCION_ENTRADA',
      description: 'Inspección de entrada del vehículo',
      assignedToId: coordinator?.id,
      checklist: {
        create: INSPECTION_CHECKLIST.map(({ category, item }) => ({
          category,
          item,
          installed: initialEquipment(vehicle, item),
        })),
      },
    },
    select,
  })
  await tx.activity.create({
    data: {
      type: 'ORDEN_INSPECCION_CREADA',
      content: 'Orden de inspección de entrada creada',
      sellerLeadId,
      agentId: actorId,
    },
  })
  return order
}
