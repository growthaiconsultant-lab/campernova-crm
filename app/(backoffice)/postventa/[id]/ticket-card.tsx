'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { StatusCorrectionDialog } from '@/components/status-correction-dialog'
import {
  TICKET_CORRECTION_TARGET,
  TICKET_FORWARD_TRANSITIONS,
  TICKET_REOPEN_TARGET,
  TICKET_STATUS_LABELS,
} from '@/lib/postventa/transitions'
import { changeTicketStatus, reopenTicket, setTicketCost } from '../actions'
import { recordFollowupResponse } from '../followup-actions'
import type { TicketStatus, TicketPriority } from '@prisma/client'

const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  ABIERTO: 'bg-red-100 text-red-700',
  EN_PROGRESO: 'bg-yellow-100 text-yellow-700',
  RESUELTO: 'bg-blue-100 text-blue-700',
  CERRADO: 'bg-green-100 text-green-700',
  ANULADO: 'bg-gray-100 text-gray-500',
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  BAJA: 'text-gray-500',
  MEDIA: 'text-blue-600',
  ALTA: 'text-amber-600',
  CRITICA: 'text-red-600',
}

interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  openedAt: Date
  dueAt: Date | null
  costEstimate: { toString(): string } | null
  costReal: { toString(): string } | null
  cost: { amount: { toString(): string } } | null
}

export function TicketCard({
  ticket,
  canEdit,
  isAdmin,
}: {
  ticket: Ticket
  canEdit: boolean
  isAdmin: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [costEstimate, setCostEstimate] = useState(
    ticket.costEstimate ? Number(ticket.costEstimate.toString()) : ''
  )
  const [costReal, setCostReal] = useState(
    ticket.costReal ? Number(ticket.costReal.toString()) : ''
  )

  const transitions = canEdit ? (TICKET_FORWARD_TRANSITIONS[ticket.status] ?? []) : []
  const correctionTarget = canEdit ? TICKET_CORRECTION_TARGET[ticket.status] : undefined
  const reopenTarget = isAdmin ? TICKET_REOPEN_TARGET[ticket.status] : undefined
  const isTerminal = ticket.status === 'CERRADO' || ticket.status === 'ANULADO'

  function handleStatusChange(newStatus: TicketStatus) {
    startTransition(async () => {
      const result = await changeTicketStatus(ticket.id, newStatus)
      if (result.ok) toast.success(`Estado actualizado a ${TICKET_STATUS_LABELS[newStatus]}.`)
      else toast.error(result.error)
    })
  }

  function handleCostSave() {
    startTransition(async () => {
      const result = await setTicketCost(ticket.id, {
        costEstimate: costEstimate !== '' ? Number(costEstimate) : null,
        costReal: costReal !== '' ? Number(costReal) : null,
      })
      if (result.ok) toast.success('Costes actualizados.')
      else toast.error(result.error)
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-cn-line bg-white">
      <div
        className="flex cursor-pointer items-start justify-between gap-3 p-4 hover:bg-cn-cream-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLORS[ticket.status]}`}
            >
              {TICKET_STATUS_LABELS[ticket.status]}
            </span>
            <span className={`text-xs font-semibold ${PRIORITY_COLORS[ticket.priority]}`}>
              {ticket.priority}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-cn-ink-700">{ticket.title}</p>
          {!isTerminal && ticket.cost && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Coste contabilizado pendiente de refinalización:{' '}
              {Number(ticket.cost.amount.toString()).toLocaleString('es-ES', {
                style: 'currency',
                currency: 'EUR',
              })}
            </p>
          )}
        </div>
        <span className="text-cn-ink-400 shrink-0 text-xs">
          {new Date(ticket.openedAt).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-cn-line p-4">
          <p className="whitespace-pre-wrap text-sm text-cn-ink-700">{ticket.description}</p>

          {(transitions.length > 0 || correctionTarget || reopenTarget) && (
            <div className="flex flex-wrap gap-2">
              <span className="text-cn-ink-400 self-center text-xs">Cambiar estado:</span>
              {transitions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={isPending}
                  className="inline-flex h-7 items-center rounded-lg border border-cn-line px-3 text-xs font-medium hover:bg-cn-cream-50 disabled:opacity-50"
                >
                  → {TICKET_STATUS_LABELS[s]}
                </button>
              ))}
              {correctionTarget && (
                <StatusCorrectionDialog
                  triggerLabel={`Corregir a ${TICKET_STATUS_LABELS[correctionTarget]}`}
                  title="Corregir estado del ticket"
                  description={`El ticket volverá de ${TICKET_STATUS_LABELS[ticket.status]} a ${TICKET_STATUS_LABELS[correctionTarget]}. La corrección quedará registrada.`}
                  confirmLabel="Corregir estado"
                  successMessage={`Ticket corregido a ${TICKET_STATUS_LABELS[correctionTarget]}.`}
                  disabled={isPending}
                  onConfirm={(reason) => changeTicketStatus(ticket.id, correctionTarget, reason)}
                />
              )}
              {reopenTarget && (
                <StatusCorrectionDialog
                  triggerLabel={`Reabrir como ${TICKET_STATUS_LABELS[reopenTarget]}`}
                  title="Reabrir ticket cerrado"
                  description="El coste contabilizado se conserva hasta el próximo cierre, que conciliará el importe de forma atómica."
                  confirmLabel="Reabrir ticket"
                  successMessage={`Ticket reabierto como ${TICKET_STATUS_LABELS[reopenTarget]}.`}
                  disabled={isPending}
                  onConfirm={(reason) => reopenTicket(ticket.id, reopenTarget, reason)}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-cn-ink-400 block text-xs font-medium">
                Coste estimado (€)
              </label>
              <input
                type="number"
                value={costEstimate}
                onChange={(e) =>
                  setCostEstimate(e.target.value === '' ? '' : Number(e.target.value))
                }
                disabled={isTerminal || !canEdit}
                className="h-8 w-full rounded-lg border border-cn-line px-2 text-sm focus:outline-none disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-cn-ink-400 block text-xs font-medium">Coste real (€)</label>
              <input
                type="number"
                value={costReal}
                onChange={(e) => setCostReal(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={isTerminal || !canEdit}
                className="h-8 w-full rounded-lg border border-cn-line px-2 text-sm focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>
          {!isTerminal && canEdit && (
            <button
              onClick={handleCostSave}
              disabled={isPending}
              className="inline-flex h-7 items-center rounded-lg bg-primary px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Guardar costes
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface Followup {
  id: string
  type: string
  status: string
  scheduledFor: Date
  sentAt: Date | null
  responseNotes: string | null
}

export function FollowupCard({ followup }: { followup: Followup }) {
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState('')

  function handleRespond() {
    startTransition(async () => {
      await recordFollowupResponse(followup.id, notes)
      setExpanded(false)
    })
  }

  const typeLabel = followup.type === 'DIA_7' ? 'Seguimiento día 7' : 'Seguimiento día 30'
  const statusColor =
    followup.status === 'RESPONDIDO'
      ? 'bg-green-100 text-green-700'
      : followup.status === 'ENVIADO'
        ? 'bg-blue-100 text-blue-700'
        : followup.status === 'FALLIDO'
          ? 'bg-red-100 text-red-700'
          : 'bg-gray-100 text-gray-600'

  return (
    <div className="overflow-hidden rounded-xl border border-cn-line bg-white">
      <div
        className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-cn-cream-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
            {followup.status}
          </span>
          <span className="text-sm text-cn-ink-700">{typeLabel}</span>
        </div>
        <span className="text-cn-ink-400 text-xs">
          {new Date(followup.scheduledFor).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      </div>

      {expanded && followup.status === 'ENVIADO' && (
        <div className="space-y-3 border-t border-cn-line p-4">
          <p className="text-sm text-cn-ink-500">Registrar respuesta del cliente:</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anotaciones de la conversación…"
            className="w-full rounded-lg border border-cn-line px-3 py-2 text-sm focus:outline-none"
          />
          <button
            onClick={handleRespond}
            disabled={isPending || !notes.trim()}
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Guardar respuesta
          </button>
        </div>
      )}

      {expanded && followup.status === 'RESPONDIDO' && followup.responseNotes && (
        <div className="border-t border-cn-line p-4">
          <p className="text-cn-ink-400 mb-1 text-xs">Respuesta registrada:</p>
          <p className="whitespace-pre-wrap text-sm text-cn-ink-700">{followup.responseNotes}</p>
        </div>
      )}
    </div>
  )
}
