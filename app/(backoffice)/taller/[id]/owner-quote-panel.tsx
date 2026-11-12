'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { euro, quoteLabels, quoteTotal, type QuoteView } from '@/lib/entry/owner-quote'
import { saveQuoteAction, sendQuoteAction } from '../owner-quote-actions'

type Mark = { id: string; item: string; notes: string | null }
const inputClass = 'mt-1 w-full rounded-md border bg-card px-3 py-2 text-sm'
const date = (value: string) =>
  new Date(value).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  })
const repairDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }) : 'Sin fecha'
function Summary({ q }: { q: QuoteView }) {
  const complete = q.lines.every((l) => l.cents !== null)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <strong>
          {quoteLabels[q.status]} · v{q.version}
        </strong>
        <span>
          {complete ? 'Total con IVA' : 'Subtotal con precio'} · {euro(quoteTotal(q.lines))}
        </span>
      </div>
      <ul className="divide-y">
        {q.lines.map((l) => (
          <li key={l.itemId} className="flex items-start justify-between gap-3 py-2 text-sm">
            <div>
              <strong>{l.item}</strong>
              <p>{l.description || 'Trabajo por definir'}</p>
            </div>
            <span className="shrink-0">{l.cents === null ? 'Por valorar' : euro(l.cents)}</span>
          </li>
        ))}
      </ul>
      {q.sentAt && (
        <p className="text-sm">
          Enviado a {q.ownerEmail} · {date(q.sentAt)}
        </p>
      )}
      {q.answeredAt && (
        <p className="text-sm font-medium">
          {quoteLabels[q.status]} desde el enlace de {q.ownerName || q.ownerEmail} ·{' '}
          {date(q.answeredAt)}
        </p>
      )}
      {q.reason && <p className="text-sm">Motivo del rechazo · {q.reason}</p>}
      {q.awaitingSchedule && (
        <p className="text-sm font-semibold">Reparaciones pendientes de programar en taller</p>
      )}
      {q.repair && (
        <div className="rounded-md bg-brand-tint p-3 text-sm">
          <strong>Planificación de las reparaciones</strong>
          <p>
            Inicio · {repairDate(q.repair.start)} · Fin · {repairDate(q.repair.end)}
          </p>
          <p>Responsable del trabajo · {q.repair.technician || 'Sin asignar'}</p>
          <Link className="text-brand underline" href={'/taller/' + q.repair.id}>
            Ver orden de reparación
          </Link>
        </div>
      )}
    </div>
  )
}

export function OwnerQuotePanel({
  orderId,
  marks,
  quotes,
  email,
  sellerId,
  canEdit,
}: {
  orderId: string
  marks: Mark[]
  quotes: QuoteView[]
  email: string
  sellerId: string
  canEdit: boolean
}) {
  const current = quotes[0],
    router = useRouter()
  const [mode, setMode] = useState<'ver' | 'editar' | 'enviar'>('ver')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [draft, setDraft] = useState<Record<string, { description: string; price: string }>>({})
  const awaitingOwner = quotes.find((q) => q.status === 'PENDIENTE')
  const pending =
    !!awaitingOwner || quotes.some((q) => q.status === 'EN_ENVIO' || q.awaitingSchedule)
  useEffect(() => {
    if (!pending || mode !== 'ver') return
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [pending, mode, router])

  function edit() {
    const initial = Object.fromEntries(
      marks.map((m) => {
        const prev = current?.lines.find((l) => l.itemId === m.id)
        return [
          m.id,
          {
            description: prev?.description ?? '',
            price: prev?.cents == null ? '' : (prev.cents / 100).toFixed(2).replace('.', ','),
          },
        ]
      })
    )
    setDraft(initial)
    setError('')
    setMode('editar')
  }
  function change(id: string, key: 'price' | 'description', value: string) {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }
  async function submit() {
    setBusy(true)
    setError('')
    try {
      const result =
        mode === 'editar'
          ? await saveQuoteAction(orderId, {
              version: current?.version ?? 0,
              revision: current?.revision ?? 0,
              lines: marks.map((m) => {
                const line = draft[m.id]
                return {
                  itemId: m.id,
                  description: line?.description ?? '',
                  cents: line?.price
                    ? Math.round(Number(line.price.replace(',', '.')) * 100)
                    : null,
                }
              }),
            })
          : await sendQuoteAction(orderId, {
              version: current.version,
              revision: current.revision,
              email,
            })
      if (result.error) setError(result.error)
      else setMode('ver')
      router.refresh()
    } catch {
      setError('No se ha podido confirmar la operación. Actualiza la inspección.')
    } finally {
      setBusy(false)
    }
  }
  const missing =
    current?.status === 'BORRADOR' &&
    (current.lines.some((l) => l.cents === null || !l.description) ||
      marks.length !== current.lines.length ||
      marks.some((m) => !current.lines.some((l) => l.itemId === m.id)))
  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-card p-4">
      <h4 className="font-semibold">Presupuesto de reparaciones</h4>
      {mode === 'editar' ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          {marks.map((m) => (
            <fieldset key={m.id} className="space-y-2 border-t pt-2">
              <legend className="font-semibold">{m.item}</legend>
              {m.notes && (
                <p className="text-sm text-muted-foreground">
                  Nota interna de inspección · {m.notes}
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
                <label className="text-sm">
                  Trabajo para el propietario
                  <input
                    className={inputClass}
                    maxLength={500}
                    value={draft[m.id]?.description ?? ''}
                    onChange={(e) => change(m.id, 'description', e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Importe con IVA (€)
                  <input
                    inputMode="decimal"
                    pattern="[0-9]{1,7}([.,][0-9]{1,2})?"
                    title="Importe en euros, con hasta dos decimales"
                    className={inputClass}
                    value={draft[m.id]?.price ?? ''}
                    onChange={(e) => change(m.id, 'price', e.target.value)}
                  />
                </label>
              </div>
            </fieldset>
          ))}
          <Button disabled={busy || !marks.length}>
            {busy ? 'Guardando…' : 'Guardar borrador'}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setMode('ver')}>
            Cancelar
          </Button>
        </form>
      ) : (
        <>
          {current && <Summary q={current} />}
          {awaitingOwner && awaitingOwner.version !== current.version && (
            <p className="text-sm font-medium">
              La versión {awaitingOwner.version} sigue pendiente de respuesta.
            </p>
          )}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'ver' && marks.length > 0 && (
                <Button size="sm" variant={current ? 'outline' : 'default'} onClick={edit}>
                  {!current
                    ? 'Preparar presupuesto'
                    : current.status === 'BORRADOR'
                      ? 'Editar borrador'
                      : 'Preparar nueva versión'}
                </Button>
              )}
              {mode === 'ver' && current && ['EN_ENVIO', 'BORRADOR'].includes(current.status) && (
                <Button
                  size="sm"
                  disabled={!!missing || !email}
                  onClick={() => {
                    setError('')
                    setMode('enviar')
                  }}
                >
                  {current.status === 'EN_ENVIO'
                    ? 'Revisar y reintentar envío'
                    : 'Revisar y enviar'}
                </Button>
              )}
              {mode === 'enviar' && (
                <div className="w-full space-y-2 rounded-md bg-brand-tint p-3">
                  <p>
                    Enviar la versión {current.version} a <strong>{email}</strong> por correo. El
                    propietario podrá revisar los trabajos y responder desde su enlace privado.
                  </p>
                  <Button size="sm" disabled={busy} onClick={() => void submit()}>
                    {busy ? 'Enviando…' : 'Enviar al propietario'}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode('ver')}>
                    Volver
                  </Button>
                </div>
              )}
            </div>
          )}
          {canEdit && current?.status === 'BORRADOR' && missing && (
            <p className="text-sm">
              Revisa las partidas marcadas y completa el trabajo y el importe de cada una para
              enviar.
            </p>
          )}
          {canEdit && !email && (
            <p className="text-sm">
              Para enviar, añade el correo en{' '}
              <a className="underline" href={'/vendedores/' + sellerId}>
                la ficha del propietario
              </a>
              .
            </p>
          )}
          {current?.status === 'EN_ENVIO' && (
            <p className="text-sm">
              El envío todavía no está confirmado. Puedes reintentarlo con el mismo presupuesto.
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {quotes.length > 1 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Versiones anteriores · {quotes.length - 1}
          </summary>
          {quotes.slice(1).map((q) => (
            <div className="border-t py-3" key={q.version}>
              <Summary q={q} />
            </div>
          ))}
        </details>
      )}
    </div>
  )
}
