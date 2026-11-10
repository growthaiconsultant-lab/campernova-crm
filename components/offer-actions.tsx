'use client'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { updateOfferStatus } from '@/app/(backoffice)/ofertas/actions'
import { OFFER_TRANSITIONS, OFFER_STATUS_LABELS } from '@/lib/offers'
import { LOST_REASON_OPTIONS } from '@/lib/lost-reason'
import type { OfferStatus } from '@prisma/client'
import type { OfferRow } from './offers-section'

export function OfferActions({ offer, onDone }: { offer: OfferRow; onDone: () => void }) {
  const [pending, setPending] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [deposit, setDeposit] = useState('')
  const [reservedUntil, setReservedUntil] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const nextStates = OFFER_TRANSITIONS[offer.status] ?? []

  async function move(next: OfferStatus, extra = {}) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await updateOfferStatus(offer.id, next, extra)
      if (res.error) setError(res.error)
      else {
        setAccepting(false)
        setRejecting(false)
        onDone()
      }
    } catch {
      setError('No se ha podido confirmar el cambio. Comprueba el estado de la oferta.')
    } finally {
      setPending(false)
    }
  }

  function pick(next: OfferStatus) {
    if (next === 'ACEPTADA') return setAccepting(true)
    if (next === 'RECHAZADA') return setRejecting(true)
    move(next)
  }

  return (
    <>
      {accepting && (
        <div className="mt-3 space-y-2 rounded border border-cyan-200 bg-cyan-50 p-3">
          <p className="text-[11px] font-medium text-cyan-800">
            Aceptar la oferta. Añade la señal para que quede reservado.
          </p>
          <div className="grid gap-2">
            <label className="grid gap-1 text-xs">
              Señal (€)
              <input
                type="number"
                min={0}
                step="0.01"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="0,00"
                disabled={pending}
                className="h-8 rounded border border-cyan-200 px-2 text-[12px]"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Reservado hasta
              <input
                disabled={pending}
                type="date"
                value={reservedUntil}
                onChange={(e) => setReservedUntil(e.target.value)}
                className="h-8 rounded border border-cyan-200 px-2 text-[12px]"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                move('ACEPTADA', {
                  depositAmount: deposit ? Number(deposit) : null,
                  reservedUntil: reservedUntil || null,
                })
              }
              className="rounded bg-cyan-700 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              Aceptar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setAccepting(false)}
              className="rounded border border-cyan-200 px-3 py-1 text-[11px] text-cyan-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="mt-3 space-y-2 rounded border border-red-200 bg-red-50 p-3">
          <select
            aria-label="Motivo del rechazo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-8 w-full rounded border border-red-200 px-2 text-[12px]"
          >
            <option value="">Motivo del rechazo…</option>
            {LOST_REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => move('RECHAZADA', { rejectionReason: reason || null })}
              className="rounded bg-red-600 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              Rechazar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setRejecting(false)}
              className="rounded border border-red-200 px-3 py-1 text-[11px] text-red-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px] text-red-600">
          {error}
        </p>
      )}

      {nextStates.length > 0 && !accepting && !rejecting && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {nextStates.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => pick(s)}
              className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-[11.5px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {s === 'CONVERTIDA' && <Check className="h-3 w-3" />}
              {OFFER_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
