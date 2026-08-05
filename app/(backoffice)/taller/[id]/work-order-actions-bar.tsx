'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import type { WorkOrderApprovalLevel, WorkOrderKind, WorkOrderStatus } from '@prisma/client'
import { StatusCorrectionDialog } from '@/components/status-correction-dialog'
import {
  WORK_ORDER_CORRECTION_TARGET,
  WORK_ORDER_FORWARD_TRANSITIONS,
  WORK_ORDER_REOPEN_TARGET,
  WORK_ORDER_STATUS_LABELS,
} from '@/lib/taller/transitions'
import {
  approveWorkOrder,
  rejectWorkOrder,
  reopenWorkOrder,
  updateWorkOrderStatus,
} from '../actions'

interface Props {
  woId: string
  status: WorkOrderStatus
  kind: WorkOrderKind
  approvalLevel: WorkOrderApprovalLevel
  isAdmin: boolean
  canEdit: boolean
}

export function WorkOrderActionsBar({
  woId,
  status,
  kind,
  approvalLevel,
  isAdmin,
  canEdit,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const forwardTransitions = canEdit ? (WORK_ORDER_FORWARD_TRANSITIONS[status] ?? []) : []
  const correctionTarget = canEdit ? WORK_ORDER_CORRECTION_TARGET[status] : undefined
  const reopenTarget =
    isAdmin && kind !== 'INSPECCION_ENTRADA' ? WORK_ORDER_REOPEN_TARGET[status] : undefined

  function handleTransition(newStatus: WorkOrderStatus) {
    startTransition(async () => {
      const result = await updateWorkOrderStatus(woId, newStatus)
      if (result.ok) toast.success(`Estado actualizado a ${WORK_ORDER_STATUS_LABELS[newStatus]}.`)
      else toast.error(result.error)
    })
  }

  function handleApprove() {
    startTransition(async () => {
      const result = await approveWorkOrder(woId)
      if (result.ok) toast.success('Orden aprobada por CEO.')
      else toast.error(result.error)
    })
  }

  function handleReject() {
    const reason = prompt('Motivo del rechazo (opcional):')
    if (reason === null) return
    startTransition(async () => {
      const result = await rejectWorkOrder(woId, reason || undefined)
      if (result.ok) toast.success('Orden rechazada.')
      else toast.error(result.error)
    })
  }

  const hasApprovalActions = isAdmin && approvalLevel === 'REQUIERE_CEO'
  if (
    forwardTransitions.length === 0 &&
    !correctionTarget &&
    !reopenTarget &&
    !hasApprovalActions
  ) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {forwardTransitions.map((target) => (
        <button
          key={target}
          onClick={() => handleTransition(target)}
          disabled={isPending}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50 ${
            target === 'RECHAZADA'
              ? 'border border-red-200 text-red-600 hover:bg-red-50'
              : 'bg-primary text-white'
          }`}
        >
          → {WORK_ORDER_STATUS_LABELS[target]}
        </button>
      ))}

      {correctionTarget && (
        <StatusCorrectionDialog
          triggerLabel={`Corregir a ${WORK_ORDER_STATUS_LABELS[correctionTarget]}`}
          title="Corregir estado de la orden"
          description={`La orden volverá de ${WORK_ORDER_STATUS_LABELS[status]} a ${WORK_ORDER_STATUS_LABELS[correctionTarget]}. La corrección quedará registrada en la actividad.`}
          confirmLabel="Corregir estado"
          successMessage={`Orden corregida a ${WORK_ORDER_STATUS_LABELS[correctionTarget]}.`}
          disabled={isPending}
          onConfirm={(reason) => updateWorkOrderStatus(woId, correctionTarget, reason)}
        />
      )}

      {reopenTarget && (
        <StatusCorrectionDialog
          triggerLabel={`Reabrir como ${WORK_ORDER_STATUS_LABELS[reopenTarget]}`}
          title="Reabrir orden cerrada"
          description="El coste contabilizado se conserva hasta que la orden vuelva a completarse. La nueva compleción conciliará el importe de forma atómica."
          confirmLabel="Reabrir orden"
          successMessage={`Orden reabierta como ${WORK_ORDER_STATUS_LABELS[reopenTarget]}.`}
          disabled={isPending}
          onConfirm={(reason) => reopenWorkOrder(woId, reopenTarget, reason)}
        />
      )}

      {hasApprovalActions && (
        <>
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Aprobar presupuesto
          </button>
          <button
            onClick={handleReject}
            disabled={isPending}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Rechazar presupuesto
          </button>
        </>
      )}
    </div>
  )
}
