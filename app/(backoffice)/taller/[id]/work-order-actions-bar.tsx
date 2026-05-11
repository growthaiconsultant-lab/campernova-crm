'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateWorkOrderStatus, approveWorkOrder, rejectWorkOrder } from '../actions'
import type { WorkOrderStatus, WorkOrderApprovalLevel } from '@prisma/client'

const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  PENDIENTE: ['EN_DIAGNOSTICO', 'RECHAZADA'],
  EN_DIAGNOSTICO: ['PRESUPUESTADA', 'RECHAZADA'],
  PRESUPUESTADA: ['EN_CURSO', 'RECHAZADA'],
  EN_CURSO: ['COMPLETADA', 'RECHAZADA'],
  COMPLETADA: [],
  RECHAZADA: [],
}

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_DIAGNOSTICO: 'En diagnóstico',
  PRESUPUESTADA: 'Presupuestada',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  RECHAZADA: 'Rechazada',
}

interface Props {
  woId: string
  status: WorkOrderStatus
  approvalLevel: WorkOrderApprovalLevel
  isAdmin: boolean
}

export function WorkOrderActionsBar({ woId, status, approvalLevel, isAdmin }: Props) {
  const [isPending, startTransition] = useTransition()
  const transitions = VALID_TRANSITIONS[status] ?? []

  function handleTransition(newStatus: WorkOrderStatus) {
    startTransition(async () => {
      const result = await updateWorkOrderStatus(woId, newStatus)
      if (result.ok) {
        toast.success(`Estado actualizado a ${STATUS_LABELS[newStatus]}.`)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleApprove() {
    startTransition(async () => {
      const result = await approveWorkOrder(woId)
      if (result.ok) {
        toast.success('Orden aprobada por CEO.')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleReject() {
    const reason = prompt('Motivo del rechazo (opcional):')
    if (reason === null) return
    startTransition(async () => {
      const result = await rejectWorkOrder(woId, reason || undefined)
      if (result.ok) {
        toast.success('Orden rechazada.')
      } else {
        toast.error(result.error)
      }
    })
  }

  if (transitions.length === 0 && !isAdmin) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Transitions */}
      {transitions.map((s) => (
        <button
          key={s}
          onClick={() => handleTransition(s)}
          disabled={isPending}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50 ${
            s === 'RECHAZADA'
              ? 'border border-red-200 text-red-600 hover:bg-red-50'
              : 'bg-cn-teal-900 text-white'
          }`}
        >
          → {STATUS_LABELS[s]}
        </button>
      ))}

      {/* Approval actions for admin */}
      {isAdmin && approvalLevel === 'REQUIERE_CEO' && (
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
