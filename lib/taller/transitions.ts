import type { WorkOrderStatus } from '@prisma/client'

export type WorkOrderTransitionKind = 'forward' | 'correction' | 'reopen'

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_DIAGNOSTICO: 'En diagnóstico',
  PRESUPUESTADA: 'Presupuestada',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  RECHAZADA: 'Rechazada',
}

export const WORK_ORDER_FORWARD_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  PENDIENTE: ['EN_DIAGNOSTICO', 'RECHAZADA'],
  EN_DIAGNOSTICO: ['PRESUPUESTADA', 'RECHAZADA'],
  PRESUPUESTADA: ['EN_CURSO', 'RECHAZADA'],
  EN_CURSO: ['COMPLETADA', 'RECHAZADA'],
  COMPLETADA: [],
  RECHAZADA: [],
}

export const WORK_ORDER_CORRECTION_TARGET: Partial<Record<WorkOrderStatus, WorkOrderStatus>> = {
  EN_DIAGNOSTICO: 'PENDIENTE',
  PRESUPUESTADA: 'EN_DIAGNOSTICO',
  EN_CURSO: 'PRESUPUESTADA',
}

export const WORK_ORDER_REOPEN_TARGET: Partial<Record<WorkOrderStatus, WorkOrderStatus>> = {
  COMPLETADA: 'EN_CURSO',
  RECHAZADA: 'PENDIENTE',
}

export function isWorkOrderTransitionAllowed(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  kind: WorkOrderTransitionKind
): boolean {
  if (kind === 'forward') return WORK_ORDER_FORWARD_TRANSITIONS[from].includes(to)
  if (kind === 'correction') return WORK_ORDER_CORRECTION_TARGET[from] === to
  return WORK_ORDER_REOPEN_TARGET[from] === to
}

export function isTerminalWorkOrderStatus(status: WorkOrderStatus): boolean {
  return status === 'COMPLETADA' || status === 'RECHAZADA'
}
