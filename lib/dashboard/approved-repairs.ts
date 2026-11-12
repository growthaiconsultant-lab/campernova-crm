import type { Prisma } from '@prisma/client'
import { inspectionCoordinator } from '../entry/inspection-coordinator'
import { quoteLines } from '../entry/owner-quote'

export async function approvedRepairQueue(db: Prisma.TransactionClient, ownerId?: string) {
  const coordinator = await inspectionCoordinator(db)
  if (ownerId && coordinator?.id !== ownerId) return null
  const inspections = await db.workOrder.findMany({
    where: {
      kind: 'INSPECCION_ENTRADA',
      ownerQuotes: { some: { status: 'ACEPTADO', repairOrderId: null } },
    },
    select: {
      id: true,
      ownerQuotes: {
        where: { status: 'ACEPTADO' },
        orderBy: { version: 'desc' },
        take: 1,
        select: {
          id: true,
          version: true,
          answeredAt: true,
          vehicleLabel: true,
          ownerName: true,
          lines: true,
          repairOrderId: true,
        },
      },
    },
  })
  const tasks = inspections
    .flatMap((inspection) => {
      const q = inspection.ownerQuotes[0]
      if (!q || q.repairOrderId) return []
      return [
        {
          quoteId: q.id,
          inspectionId: inspection.id,
          version: q.version,
          vehicle: q.vehicleLabel || 'Vehículo de la inspección',
          owner: q.ownerName,
          coordinator: coordinator?.name ?? null,
          answeredAt: q.answeredAt?.toISOString() ?? '',
          lines: quoteLines.parse(q.lines),
        },
      ]
    })
    .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt) || a.quoteId.localeCompare(b.quoteId))
  const users = tasks.length
    ? await db.user.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []
  return { tasks, users }
}
export type ApprovedRepairQueue = NonNullable<Awaited<ReturnType<typeof approvedRepairQueue>>>
