import type { Prisma, WorkOrderStatus } from '@prisma/client'
import { isWorkOrderTransitionAllowed, type WorkOrderTransitionKind } from './transitions'

export type WorkOrderTransitionErrorCode =
  | 'WORK_ORDER_NOT_FOUND'
  | 'TRANSITION_NOT_ALLOWED'
  | 'CORRECTION_REASON_REQUIRED'
  | 'CEO_APPROVAL_REQUIRED'
  | 'INSPECTION_TERMINAL'
  | 'STATE_CONFLICT'

export class WorkOrderTransitionError extends Error {
  constructor(readonly code: WorkOrderTransitionErrorCode) {
    super(code)
    this.name = 'WorkOrderTransitionError'
  }
}

export const WORK_ORDER_TRANSITION_ERROR_MESSAGES: Record<WorkOrderTransitionErrorCode, string> = {
  WORK_ORDER_NOT_FOUND: 'Orden no encontrada.',
  TRANSITION_NOT_ALLOWED: 'La transición de estado no está permitida.',
  CORRECTION_REASON_REQUIRED: 'Indica el motivo de la corrección.',
  CEO_APPROVAL_REQUIRED: 'La orden requiere aprobación del CEO antes de empezar.',
  INSPECTION_TERMINAL: 'Una inspección de entrada cerrada no puede reabrirse.',
  STATE_CONFLICT: 'La orden cambió mientras la editabas. Recarga la ficha e inténtalo de nuevo.',
}

export function isWorkOrderTransitionError(error: unknown): error is WorkOrderTransitionError {
  return error instanceof WorkOrderTransitionError
}

type TransitionParams = {
  workOrderId: string
  expectedCurrentStatus: WorkOrderStatus
  target: WorkOrderStatus
  kind: WorkOrderTransitionKind
  actorId: string
  reason?: string | null
}

export type WorkOrderTransitionResult = {
  changed: boolean
  vehicleId: string
  sellerLeadId: string
  previousStatus: WorkOrderStatus
  status: WorkOrderStatus
}

function transitionTimestamps(
  target: WorkOrderStatus,
  now: Date,
  startedAt: Date | null
): Prisma.WorkOrderUpdateManyMutationInput {
  if (target === 'PENDIENTE' || target === 'EN_DIAGNOSTICO' || target === 'PRESUPUESTADA') {
    return { status: target, startedAt: null, completedAt: null }
  }
  if (target === 'EN_CURSO') {
    return { status: target, startedAt: startedAt ?? now, completedAt: null }
  }
  if (target === 'COMPLETADA') {
    return { status: target, startedAt: startedAt ?? now, completedAt: now }
  }
  return { status: target, completedAt: null }
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export async function transitionWorkOrderTx(
  tx: Prisma.TransactionClient,
  params: TransitionParams
): Promise<WorkOrderTransitionResult> {
  const order = await tx.workOrder.findUnique({
    where: { id: params.workOrderId },
    select: {
      status: true,
      kind: true,
      approvalLevel: true,
      vehicleId: true,
      startedAt: true,
      vehicle: { select: { sellerLeadId: true } },
      timeEntries: { select: { hours: true, hourlyRate: true } },
      parts: { select: { quantity: true, unitCost: true } },
      costs: { select: { amount: true } },
    },
  })
  if (!order) throw new WorkOrderTransitionError('WORK_ORDER_NOT_FOUND')

  if (order.status === params.target) {
    return {
      changed: false,
      vehicleId: order.vehicleId,
      sellerLeadId: order.vehicle.sellerLeadId,
      previousStatus: order.status,
      status: order.status,
    }
  }

  if (order.status !== params.expectedCurrentStatus) {
    throw new WorkOrderTransitionError('STATE_CONFLICT')
  }

  if (!isWorkOrderTransitionAllowed(order.status, params.target, params.kind)) {
    throw new WorkOrderTransitionError('TRANSITION_NOT_ALLOWED')
  }
  const reason = params.reason?.trim() ?? ''
  if (params.kind !== 'forward' && reason.length === 0) {
    throw new WorkOrderTransitionError('CORRECTION_REASON_REQUIRED')
  }
  if (params.kind === 'reopen' && order.kind === 'INSPECCION_ENTRADA') {
    throw new WorkOrderTransitionError('INSPECTION_TERMINAL')
  }
  if (
    params.target === 'EN_CURSO' &&
    order.approvalLevel !== 'NO_REQUIERE' &&
    order.approvalLevel !== 'APROBADA_CEO'
  ) {
    throw new WorkOrderTransitionError('CEO_APPROVAL_REQUIRED')
  }

  const now = new Date()
  const cas = await tx.workOrder.updateMany({
    where: { id: params.workOrderId, status: order.status },
    data: transitionTimestamps(params.target, now, order.startedAt),
  })
  if (cas.count !== 1) throw new WorkOrderTransitionError('STATE_CONFLICT')

  const previousPostedCost = order.costs.reduce((sum, cost) => sum + Number(cost.amount), 0)
  let nextPostedCost = previousPostedCost

  if (params.target === 'COMPLETADA') {
    const labour = order.timeEntries.reduce(
      (sum, entry) => sum + Number(entry.hours) * Number(entry.hourlyRate),
      0
    )
    const parts = order.parts.reduce((sum, part) => sum + part.quantity * Number(part.unitCost), 0)

    const postings = [
      {
        category: 'MANO_OBRA_TALLER' as const,
        description: `Mano de obra taller (orden ${params.workOrderId.slice(0, 8)})`,
        amount: labour,
      },
      {
        category: 'PIEZAS' as const,
        description: `Piezas y repuestos (orden ${params.workOrderId.slice(0, 8)})`,
        amount: parts,
      },
    ]

    for (const posting of postings) {
      if (posting.amount > 0) {
        await tx.vehicleCost.upsert({
          where: {
            workOrderId_category: {
              workOrderId: params.workOrderId,
              category: posting.category,
            },
          },
          create: {
            vehicleId: order.vehicleId,
            category: posting.category,
            description: posting.description,
            amount: posting.amount,
            createdById: params.actorId,
            workOrderId: params.workOrderId,
          },
          update: {
            description: posting.description,
            amount: posting.amount,
            createdById: params.actorId,
          },
        })
      } else {
        await tx.vehicleCost.deleteMany({
          where: { workOrderId: params.workOrderId, category: posting.category },
        })
      }
    }
    nextPostedCost = labour + parts
  }

  const activityType =
    params.target === 'COMPLETADA'
      ? 'ORDEN_TALLER_COMPLETADA'
      : params.target === 'RECHAZADA'
        ? 'ORDEN_TALLER_RECHAZADA'
        : 'CAMBIO_ESTADO'
  const actionLabel =
    params.kind === 'forward'
      ? 'Orden de taller'
      : params.kind === 'correction'
        ? 'Corrección de orden'
        : 'Reapertura de orden'
  const costDetail =
    params.target === 'COMPLETADA'
      ? ` · Coste contabilizado: ${formatMoney(previousPostedCost)} → ${formatMoney(nextPostedCost)}`
      : ''

  await tx.activity.create({
    data: {
      type: activityType,
      content: `${actionLabel}: ${order.status} → ${params.target}${reason ? ` · Motivo: ${reason}` : ''}${costDetail}`,
      agentId: params.actorId,
      sellerLeadId: order.vehicle.sellerLeadId,
    },
  })

  return {
    changed: true,
    vehicleId: order.vehicleId,
    sellerLeadId: order.vehicle.sellerLeadId,
    previousStatus: order.status,
    status: params.target,
  }
}
