'use client'
import Link from 'next/link'
import { useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import type { saveSellerFollowup } from '@/app/(backoffice)/vendedores/[id]/followup-action'

type Props = {
  save: (input: unknown) => ReturnType<typeof saveSellerFollowup>
  archived: boolean
  assignee: string
  callReminder: { dueAt: string | null } | null
}
export function SellerFollowupForm({ save, archived, assignee, callReminder }: Props) {
  const router = useRouter(),
    id = useId()
  const [mode, setMode] = useState<'call' | 'plan' | null>(null)
  const [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [event, setEvent] = useState<string>()
  const busy = useRef(false),
    key = useRef(''),
    callButton = useRef<HTMLButtonElement>(null),
    planButton = useRef<HTMLButtonElement>(null)
  function open(which: 'call' | 'plan') {
    key.current = ''
    setMode(which)
    setError('')
    setNotice('')
    setEvent(undefined)
  }
  function close() {
    const trigger = mode === 'call' ? callButton : planButton
    setMode(null)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy.current) return
    const data = new FormData(e.currentTarget)
    const title = String(data.get('title') ?? '').trim(),
      raw = String(data.get('when') ?? ''),
      outcome = String(data.get('outcome') ?? '').trim()
    if (
      (mode === 'call' && !outcome) ||
      (mode === 'plan' && !title) ||
      Boolean(title) !== Boolean(raw)
    ) {
      setError(
        'Escribe el resultado de la llamada y completa el título y la fecha si programas un paso.'
      )
      return
    }
    const date = raw ? new Date(raw) : null
    if (date && !Number.isFinite(date.getTime())) {
      setError('Revisa la fecha y hora.')
      return
    }
    busy.current = true
    setPending(true)
    setError('')
    try {
      key.current ||= crypto.randomUUID()
      const result = await save({
        requestId: key.current,
        outcome: mode === 'call' ? outcome : null,
        next: date ? { title, startAt: date.toISOString() } : null,
        finishReminder: data.has('finish') ? callReminder : null,
      })
      if (!result.ok) {
        setError(result.error ?? 'Revisa el seguimiento e inténtalo de nuevo.')
        return
      }
      setEvent(result.eventId)
      setNotice(
        mode === 'plan'
          ? 'Acción programada.'
          : date
            ? 'Llamada registrada y siguiente paso programado.'
            : 'Llamada registrada.'
      )
      close()
      router.refresh()
    } catch {
      setError('No se pudo confirmar el guardado. Reintenta con los mismos datos.')
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return (
    <div className="mt-3 space-y-2">
      {!mode ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" ref={callButton} onClick={() => open('call')}>
            Registrar llamada
          </Button>
          {!archived && (
            <Button ref={planButton} type="button" variant="outline" onClick={() => open('plan')}>
              Programar
            </Button>
          )}
        </div>
      ) : (
        <form
          aria-label={mode === 'call' ? 'Registrar llamada' : 'Programar acción'}
          onSubmit={submit}
        >
          <fieldset disabled={pending} className="space-y-3 rounded-lg border bg-card p-4">
            {mode === 'call' && (
              <>
                <label className="block text-sm font-medium" htmlFor={id + 'outcome'}>
                  ¿Qué habéis hablado?
                </label>
                <Textarea
                  id={id + 'outcome'}
                  autoFocus
                  name="outcome"
                  required
                  maxLength={2000}
                  rows={2}
                />
                {callReminder && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="finish" />
                    Marcar como hecho el recordatorio de llamar
                  </label>
                )}
              </>
            )}
            {!archived && (
              <>
                <label className="block text-sm font-medium" htmlFor={id + 'title'}>
                  {mode === 'call' ? 'Siguiente paso (opcional)' : 'Siguiente paso'}
                </label>
                <Input
                  id={id + 'title'}
                  name="title"
                  autoFocus={mode === 'plan'}
                  required={mode === 'plan'}
                  maxLength={160}
                  placeholder="Ej. Llamar para comentar la oferta"
                />
                <label className="block text-sm font-medium" htmlFor={id + 'date'}>
                  Fecha y hora del siguiente paso
                </label>
                <Input
                  className="w-full min-w-0"
                  id={id + 'date'}
                  type="datetime-local"
                  name="when"
                  required={mode === 'plan'}
                />
                <p className="text-xs text-muted-foreground">
                  Hora local de tu dispositivo · Responsable de la acción: {assignee}
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{pending ? 'Guardando…' : 'Guardar seguimiento'}</Button>
              <Button type="button" variant="outline" onClick={close}>
                Cancelar
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}{' '}
          {event && (
            <Link className="underline" href={'/calendario/' + event}>
              Ver en el calendario
            </Link>
          )}
        </p>
      )}
    </div>
  )
}
