'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateCalendarEventStatus } from '../actions'
import { EVENT_STATUS_LABELS, EVENT_STATUS_TRANSITIONS } from '@/lib/calendar/event-meta'
import type { CalendarEventStatus } from '@prisma/client'

type Props = { eventId: string; status: CalendarEventStatus }

const DESTRUCTIVE: CalendarEventStatus[] = ['CANCELADO', 'NO_SHOW']

export function EventStatusBar({ eventId, status }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<CalendarEventStatus | null>(null)
  const [text, setText] = useState('')

  const transitions = EVENT_STATUS_TRANSITIONS[status]

  function apply(next: CalendarEventStatus) {
    setError(null)
    startTransition(async () => {
      const extra =
        next === 'COMPLETADO'
          ? { resultNotes: text }
          : DESTRUCTIVE.includes(next)
            ? { cancellationReason: text }
            : undefined
      const result = await updateCalendarEventStatus(eventId, next, extra)
      if (result.error) setError(result.error)
      else {
        setPrompt(null)
        setText('')
        router.refresh()
      }
    })
  }

  function onClick(next: CalendarEventStatus) {
    // Completar / cancelar / no-show piden una nota antes
    if (next === 'COMPLETADO' || DESTRUCTIVE.includes(next)) {
      setPrompt(next)
      setText('')
    } else {
      apply(next)
    }
  }

  if (transitions.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Evento en estado final.</p>
  }

  return (
    <div className="space-y-3">
      {prompt ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-[13px] font-medium">
            {prompt === 'COMPLETADO' ? 'Resultado del evento' : 'Motivo'}
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={
              prompt === 'COMPLETADO'
                ? 'Cómo fue, próxima acción…'
                : 'Por qué se cancela / no se presentó'
            }
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => apply(prompt)}
              disabled={pending}
              className="rounded-lg bg-foreground px-3 py-1.5 text-[12.5px] font-semibold text-background disabled:opacity-50"
            >
              {pending ? 'Guardando…' : `Marcar ${EVENT_STATUS_LABELS[prompt]}`}
            </button>
            <button
              type="button"
              onClick={() => setPrompt(null)}
              disabled={pending}
              className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] text-muted-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {transitions.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onClick(t)}
              disabled={pending}
              className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${
                DESTRUCTIVE.includes(t)
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-border text-foreground hover:bg-muted'
              }`}
            >
              {EVENT_STATUS_LABELS[t]}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-[13px] text-red-600">{error}</p>}
    </div>
  )
}
