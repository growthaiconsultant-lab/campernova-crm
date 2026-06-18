import type { PrismaClient } from '@prisma/client'

/**
 * Adaptadores con Prisma para la planificación del taller (la lógica pura vive en `scheduling.ts`).
 */

/** Estados de orden que cuentan como "trabajo pendiente en cola" para la capacidad. */
const ACTIVE_WORK_ORDER_STATUSES = [
  'PENDIENTE',
  'EN_DIAGNOSTICO',
  'PRESUPUESTADA',
  'EN_CURSO',
] as const

/**
 * Horas previstas que un mecánico ya tiene en cola: suma de `estimatedHours` de sus órdenes
 * activas (sin completar ni rechazar). Es el "backlog" que retrasa el arranque de una orden nueva.
 *
 * @param excludeWorkOrderId  Orden a excluir del cómputo (p.ej. al re-planificar la propia orden).
 */
export async function getMechanicBacklogHours(
  database: PrismaClient,
  mechanicId: string,
  excludeWorkOrderId?: string
): Promise<number> {
  const orders = await database.workOrder.findMany({
    where: {
      assignedToId: mechanicId,
      status: { in: [...ACTIVE_WORK_ORDER_STATUSES] },
      ...(excludeWorkOrderId ? { id: { not: excludeWorkOrderId } } : {}),
    },
    select: { estimatedHours: true },
  })

  return orders.reduce((sum, o) => sum + (o.estimatedHours ? Number(o.estimatedHours) : 0), 0)
}
