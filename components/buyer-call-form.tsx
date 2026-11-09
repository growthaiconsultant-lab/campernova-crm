'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { BUYER_ACTION_OPTIONS } from '@/lib/buyer-followup'

export type BuyerCallInput = {
  requestId: string
  outcome: string
  next: { action: string; startAt: string } | null
}

export function BuyerCallForm({
  archived,
  save,
}: {
  archived: boolean
  save: (input: BuyerCallInput) => Promise<{ ok?: boolean; error?: string; eventId?: string }>
}) {
  const router = useRouter()
  const requestId = useRef('')
  const busy = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState('')
  const [action, setAction] = useState('')
  const [when, setWhen] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [savedEvent, setSavedEvent] = useState<string>()
  const [message, setMessage] = useState('')

  function close() {
    setOpen(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy.current) return
    const date = action ? new Date(when) : null
    if (!outcome.trim() || (date && !Number.isFinite(date.getTime()))) {
      setError('Escribe el resultado y revisa la fecha del siguiente paso.')
      return
    }
    busy.current = true
    setPending(true)
    setError('')
    try {
      requestId.current ||= crypto.randomUUID()
      const result = await save({
        requestId: requestId.current,
        outcome: outcome.trim(),
        next: date ? { action, startAt: date.toISOString() } : null,
      })
      if (!result.ok) {
        setError(result.error ?? 'No se ha podido confirmar el guardado.')
        return
      }
      setSavedEvent(result.eventId)
      setMessage(
        action
          ? 'Llamada registrada y siguiente paso programado en el calendario.'
          : 'Llamada registrada.'
      )
      setOutcome('')
      setWhen('')
      setAction('')
      requestId.current = ''
      close()
      router.refresh()
    } catch {
      setError(
        'No se ha podido confirmar el guardado. El contenido se conserva para que puedas reintentar.'
      )
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return (
    <div className="mt-4">
      {!open && (
        <Button
          ref={trigger}
          type="button"
          aria-expanded={false}
          onClick={() => {
            setOpen(true)
            setError('')
            setMessage('')
          }}
        >
          <PhoneCall size={16} className="mr-2" aria-hidden="true" />
          Registrar llamada
        </Button>
      )}
      {open && (
        <form onSubmit={submit} aria-label="Registrar llamada">
          <fieldset disabled={pending} className="space-y-3">
            <legend className="mb-3 font-semibold">Registrar llamada</legend>
            <label className="block text-sm font-medium" htmlFor="buyer-call-outcome">
              ¿Qué ha pasado en la llamada?
            </label>
            <Textarea
              autoFocus
              id="buyer-call-outcome"
              rows={3}
              maxLength={2000}
              required
              value={outcome}
              placeholder="Por ejemplo, le interesan dos campers con baño."
              onChange={(e) => setOutcome(e.target.value)}
            />
            {!archived && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid content-start gap-1 text-sm font-medium">
                  <label htmlFor="buyer-call-step">Siguiente paso</label>
                  <select
                    id="buyer-call-step"
                    className="h-10 w-full rounded-md border bg-background px-2"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                  >
                    <option value="">Solo registrar la llamada</option>
                    {BUYER_ACTION_OPTIONS.filter((o) => o.value !== 'OTRO').map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {action && (
                  <div className="grid min-w-0 content-start gap-1 text-sm font-medium">
                    <label htmlFor="buyer-call-when">Fecha y hora</label>
                    <input
                      id="buyer-call-when"
                      aria-describedby="buyer-call-zone"
                      type="datetime-local"
                      className="h-10 min-w-0 rounded-md border bg-background px-2"
                      required
                      value={when}
                      onChange={(e) => setWhen(e.target.value)}
                    />
                    <span
                      id="buyer-call-zone"
                      className="text-xs font-normal text-muted-foreground"
                    >
                      Hora de tu dispositivo · {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </span>
                  </div>
                )}
              </div>
            )}
            {archived && (
              <p className="text-sm text-muted-foreground">
                Puedes registrar la llamada. Para programar una acción, reactiva el comprador.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!outcome.trim()}>
                {pending ? 'Guardando…' : 'Guardar seguimiento'}
              </Button>
              <Button type="button" variant="outline" onClick={close}>
                Cerrar
              </Button>
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm text-emerald-700">
          {message}{' '}
          {savedEvent && (
            <Link className="font-medium underline" href={`/calendario/${savedEvent}`}>
              Ver en el calendario
            </Link>
          )}
        </p>
      )}
    </div>
  )
}
