'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BUYER_ACTION_OPTIONS, buyerActionInput } from '@/lib/buyer-followup'
import type { CreateCalendarEventInput } from '@/lib/validators/calendar-event'

export type BuyerPendingAction = {
  id: string
  title: string
  description: string | null
  startAt: string
  assignee: string | null
  overdue: boolean
}

export function BuyerActionsPanel({
  buyerLeadId,
  actorId,
  actions,
  createAction,
  legacyAction,
  pagination,
  archived,
}: {
  buyerLeadId: string
  actorId: string
  actions: BuyerPendingAction[]
  createAction: (input: CreateCalendarEventInput) => Promise<{ error?: string; id?: string }>
  legacyAction?: React.ReactNode
  pagination?: React.ReactNode
  archived: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState('LLAMAR')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [commitment, setCommitment] = useState<'' | 'EXTERNO' | 'INTERNO'>('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [zone, setZone] = useState('')
  const saving = useRef(false)
  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving.current) return
    saving.current = true
    setPending(true)
    setError(null)
    setSuccess(false)
    try {
      const input = buyerActionInput({
        buyerLeadId,
        actorId,
        action,
        title,
        date,
        time,
        notes,
        commitment,
      })
      const result = await createAction(input)
      if (result.error) setError(result.error)
      else if (result.id) {
        setTitle('')
        setDate('')
        setTime('')
        setNotes('')
        setCommitment('')
        setAction('LLAMAR')
        setOpen(false)
        setSuccess(true)
        router.refresh()
      } else setError('No se ha podido confirmar el guardado de la acción.')
    } catch {
      setError(
        'No se ha podido guardar la acción. Revisa la agenda antes de volver a intentarlo; los datos se conservan.'
      )
    } finally {
      saving.current = false
      setPending(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm'
  return (
    <section
      aria-labelledby="buyer-actions-title"
      className="min-w-0 rounded-xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="buyer-actions-title" className="scroll-mt-20 text-base font-semibold">
          Próximas acciones
        </h2>
        {!open && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setOpen(true)
              setSuccess(false)
            }}
            disabled={archived}
          >
            <CalendarPlus className="mr-2 h-4 w-4" />
            Programar acción
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Puedes dejar varias acciones pendientes. Se verán también en el calendario.
      </p>
      {archived && (
        <p className="mt-2 text-sm text-muted-foreground">
          Reactiva el comprador para programar nuevas acciones.
        </p>
      )}
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <fieldset disabled={pending} className="space-y-3">
            <div>
              <label htmlFor="buyer-action-type" className="mb-1 block text-sm font-medium">
                Tipo de acción
              </label>
              <select
                id="buyer-action-type"
                className={inputClass}
                value={action}
                onChange={(event) => {
                  setAction(event.target.value)
                  setCommitment('')
                }}
              >
                {BUYER_ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="buyer-action-title" className="mb-1 block text-sm font-medium">
                Qué hay que hacer{action !== 'OTRO' && ' (opcional)'}
              </label>
              <input
                id="buyer-action-title"
                className={inputClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                required={action === 'OTRO'}
                placeholder="Ej.: Enviar dos campers de 4 plazas"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="buyer-action-date" className="mb-1 block text-sm font-medium">
                  Día
                </label>
                <input
                  id="buyer-action-date"
                  type="date"
                  required
                  className={`${inputClass} min-w-0`}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="buyer-action-time" className="mb-1 block text-sm font-medium">
                  Hora
                </label>
                <input
                  id="buyer-action-time"
                  type="time"
                  required
                  className={`${inputClass} min-w-0`}
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Horario de tu dispositivo{zone ? `: ${zone}` : ''}.
            </p>
            <div>
              <label htmlFor="buyer-action-notes" className="mb-1 block text-sm font-medium">
                Nota para esta acción (opcional)
              </label>
              <textarea
                id="buyer-action-notes"
                className={inputClass}
                rows={2}
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ej.: Llamar después del trabajo; quiere comentar la financiación."
              />
            </div>
            {action !== 'VISITA' && (
              <div>
                <label htmlFor="buyer-action-commitment" className="mb-1 block text-sm font-medium">
                  ¿Está acordada con el cliente?
                </label>
                <select
                  id="buyer-action-commitment"
                  className={inputClass}
                  value={commitment}
                  onChange={(event) => setCommitment(event.target.value as typeof commitment)}
                >
                  <option value="">Sin especificar</option>
                  <option value="EXTERNO">Sí, acordada con el cliente</option>
                  <option value="INTERNO">No, es un recordatorio mío</option>
                </select>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm">
                {pending ? 'Guardando…' : 'Guardar acción'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpen(false)
                  setError(null)
                }}
              >
                Cancelar
              </Button>
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
      {success && (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          Acción programada en la ficha y en el calendario.
        </p>
      )}
      <div className="mt-4 space-y-3">
        {legacyAction}
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay más acciones de agenda pendientes.</p>
        ) : (
          <ol className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {actions.map((item) => (
              <li key={item.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="break-words text-sm font-medium">{item.title}</p>
                  <Link
                    className="text-xs font-medium text-sidebar-primary underline"
                    href={`/calendario/${item.id}`}
                  >
                    Ver / gestionar
                  </Link>
                </div>
                <p
                  className={`mt-1 text-xs ${item.overdue ? 'font-medium text-amber-700' : 'text-muted-foreground'}`}
                >
                  {item.overdue && 'Vencida · '}
                  <time dateTime={item.startAt}>
                    {new Date(item.startAt).toLocaleString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Europe/Madrid',
                    })}
                  </time>{' '}
                  · hora de Madrid
                </p>
                {item.description && (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.description}</p>
                )}
                {item.assignee && (
                  <p className="mt-2 text-xs text-muted-foreground">Responsable: {item.assignee}</p>
                )}
              </li>
            ))}
          </ol>
        )}
        {pagination}
      </div>
    </section>
  )
}
