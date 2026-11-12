'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarClock } from 'lucide-react'
import { scheduleApprovedRepair } from '../owner-quote-actions'
import { suggestScheduleForOrder, scheduleWorkOrder } from '../actions'

interface User {
  id: string
  name: string
}

type Props = ({ woId: string; quoteId?: never } | { quoteId: string; woId?: never }) & {
  users: User[]
  assignedToId: string | null
  assignedToName: string | null
  estimatedHours: number | null
  scheduledStart: string | null
  scheduledEnd: string | null
  isClosed: boolean
  canEdit: boolean
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function isoToDateInput(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function fmt(value: string): string {
  return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const inputClass =
  'h-10 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20'

export function ScheduleCard({
  woId,
  quoteId,
  users,
  assignedToId,
  assignedToName,
  estimatedHours,
  scheduledStart,
  scheduledEnd,
  isClosed,
  canEdit,
}: Props) {
  const router = useRouter()
  const fieldId = useId()
  const [isPending, startTransition] = useTransition()

  const isScheduled = Boolean(scheduledStart && scheduledEnd)
  const [editing, setEditing] = useState(canEdit && !isScheduled)
  const [assignee, setAssignee] = useState(assignedToId ?? '')
  const [hours, setHours] = useState(estimatedHours != null ? String(estimatedHours) : '')
  const [startDate, setStartDate] = useState(scheduledStart ? isoToDateInput(scheduledStart) : '')
  const [endDate, setEndDate] = useState(scheduledEnd ? isoToDateInput(scheduledEnd) : '')
  const [suggestion, setSuggestion] = useState<string | null>(null)

  function handleSuggest() {
    if (!assignee) return toast.error('Elige primero el responsable.')
    if (!hours || parseFloat(hours) <= 0) return toast.error('Indica las horas previstas.')
    startTransition(async () => {
      const r = await suggestScheduleForOrder({
        assignedToId: assignee,
        estimatedHours: parseFloat(hours),
        excludeWorkOrderId: woId,
      })
      if (r.ok && r.data) {
        setStartDate(isoToDateInput(r.data.start))
        setEndDate(isoToDateInput(r.data.end))
        const dias = r.data.workingDaysNeeded
        setSuggestion(
          `Primer hueco: ${fmt(r.data.start)} · entrega estimada: ${fmt(r.data.end)} (${dias} día${dias === 1 ? '' : 's'} de trabajo)`
        )
      } else {
        toast.error(!r.ok ? r.error : 'No se pudo calcular la fecha.')
      }
    })
  }

  function handlePlanificar() {
    if (!assignee) return toast.error('Elige el responsable.')
    if (!startDate || !endDate) return toast.error('Indica las fechas (o pulsa "Sugerir fecha").')
    if (quoteId && (!hours || !(Number(hours) > 0)))
      return toast.error('Indica las horas previstas.')
    if (endDate < startDate) return toast.error('La fecha de fin no puede ser anterior al inicio.')
    startTransition(async () => {
      const input = { assignedToId: assignee, estimatedHours: hours ? Number(hours) : null }
      const r =
        woId !== undefined
          ? await scheduleWorkOrder(woId, {
              ...input,
              scheduledStart: startDate + 'T12:00:00',
              scheduledEnd: endDate + 'T12:00:00',
            })
          : await scheduleApprovedRepair(quoteId, {
              ...input,
              scheduledStart: startDate,
              scheduledEnd: endDate,
            })
      if (r.ok) {
        toast.success('Orden planificada y bloqueada en la agenda.')
        setSuggestion(null)
        setEditing(false)
        router.refresh()
      } else {
        toast.error(r.error)
        if (quoteId) router.refresh()
      }
    })
  }

  return (
    <div className="rounded-xl border border-cn-line bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-cn-teal-900" />
        <h3 className="text-sm font-semibold text-cn-ink-700">Planificación</h3>
      </div>

      {/* Estado actual */}
      {isScheduled && !editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-medium text-cn-teal-900">
              {fmt(scheduledStart!)} → {fmt(scheduledEnd!)}
            </span>
            <span className="text-cn-ink-500"> · {assignedToName ?? 'sin responsable'}</span>
            <p className="text-cn-ink-400 mt-0.5 text-xs">
              Entrega estimada: {fmt(scheduledEnd!)} · bloqueado en la agenda
            </p>
          </div>
          {!isClosed && canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex h-9 items-center rounded-lg border border-cn-line px-3 text-sm text-cn-ink-500 hover:bg-cn-cream-50"
            >
              Reprogramar
            </button>
          )}
        </div>
      ) : isClosed ? (
        <p className="text-cn-ink-400 text-sm">La orden está cerrada; no se puede planificar.</p>
      ) : !canEdit ? (
        <p className="text-cn-ink-400 text-sm">Sin planificación registrada.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={fieldId + '-who'}
                className="mb-1.5 block text-xs font-medium text-cn-ink-700"
              >
                Responsable
              </label>
              <select
                id={fieldId + '-who'}
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className={inputClass}
              >
                <option value="">Elige a quién…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={fieldId + '-hours'}
                className="mb-1.5 block text-xs font-medium text-cn-ink-700"
              >
                Horas previstas
              </label>
              <input
                id={fieldId + '-hours'}
                type="number"
                step="0.5"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="12"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <button
              onClick={handleSuggest}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary px-3 text-sm font-medium text-cn-teal-900 hover:bg-cn-cream-50 disabled:opacity-50"
            >
              <CalendarClock className="h-4 w-4" />
              Sugerir fecha de entrega
            </button>
            {suggestion && (
              <p className="mt-2 rounded-lg bg-cn-cream-50 px-3 py-2 text-sm text-cn-ink-700">
                {suggestion}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={fieldId + '-start'}
                className="mb-1.5 block text-xs font-medium text-cn-ink-700"
              >
                Inicio
              </label>
              <input
                id={fieldId + '-start'}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor={fieldId + '-end'}
                className="mb-1.5 block text-xs font-medium text-cn-ink-700"
              >
                Fin (entrega)
              </label>
              <input
                id={fieldId + '-end'}
                min={startDate || undefined}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-cn-line pt-3">
            {isScheduled && (
              <button
                onClick={() => setEditing(false)}
                className="inline-flex h-10 items-center rounded-lg border border-cn-line px-4 text-sm text-cn-ink-500 hover:bg-cn-cream-50"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handlePlanificar}
              disabled={isPending}
              className="h-10 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {quoteId ? 'Guardar en la agenda' : 'Planificar y bloquear en agenda'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
