'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Check, HandCoins, ExternalLink } from 'lucide-react'
import { createOffer, updateOfferStatus } from '@/app/(backoffice)/ofertas/actions'
import {
  OFFER_STATUS_LABELS,
  OFFER_STATUS_COLORS,
  OFFER_TRANSITIONS,
  isReservation,
} from '@/lib/offers'
import { LOST_REASON_OPTIONS } from '@/lib/lost-reason'
import type { OfferStatus } from '@prisma/client'

export type OfferRow = {
  id: string
  amount: number
  depositAmount: number | null
  status: OfferStatus
  reservedUntil: string | null
  notes: string | null
  counterpartLabel: string
  counterpartHref: string
}

type Candidate = { id: string; label: string }

type Props = {
  side: 'buyer' | 'vehicle'
  fixedId: string
  candidates: Candidate[]
  offers: OfferRow[]
}

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export function OffersSection({ side, fixedId, candidates, offers }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [counterpart, setCounterpart] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submitNew() {
    if (!counterpart) return setError(side === 'buyer' ? 'Elige un vehículo' : 'Elige un comprador')
    if (!amount || Number(amount) <= 0) return setError('Indica un importe')
    setError(null)
    const payload =
      side === 'buyer'
        ? { buyerLeadId: fixedId, vehicleId: counterpart }
        : { vehicleId: fixedId, buyerLeadId: counterpart }
    startTransition(async () => {
      const res = await createOffer({ ...payload, amount: Number(amount), notes })
      if (res.error) setError(res.error)
      else {
        setAdding(false)
        setCounterpart('')
        setAmount('')
        setNotes('')
        router.refresh()
      }
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
          <HandCoins className="h-4 w-4 text-muted-foreground" />
          Ofertas y reservas
        </h2>
        {candidates.length > 0 && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Registrar oferta
          </button>
        )}
      </div>

      <div className="p-6">
        {adding && (
          <div className="mb-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  {side === 'buyer' ? 'Vehículo' : 'Comprador'}
                </label>
                <select
                  value={counterpart}
                  onChange={(e) => setCounterpart(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px]"
                >
                  <option value="">Selecciona…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Importe ofertado (€)
                </label>
                <input
                  type="number"
                  min={0}
                  step="500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej: 38000"
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px]"
                />
              </div>
            </div>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas (condiciones, financiación pendiente…)"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px]"
            />
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submitNew}
                disabled={pending}
                className="rounded-lg bg-foreground px-4 py-2 text-[12.5px] font-semibold text-background disabled:opacity-50"
              >
                {pending ? 'Guardando…' : 'Registrar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false)
                  setError(null)
                }}
                className="rounded-lg border border-border px-4 py-2 text-[12.5px] font-medium text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {offers.length === 0 && !adding ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            Sin ofertas todavía.
            {candidates.length === 0 && ' Genera un match primero para poder registrar una oferta.'}
          </p>
        ) : (
          <div className="space-y-3">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} onDone={() => router.refresh()} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function OfferCard({ offer, onDone }: { offer: OfferRow; onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [deposit, setDeposit] = useState('')
  const [reservedUntil, setReservedUntil] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const nextStates = OFFER_TRANSITIONS[offer.status] ?? []
  const reservation = isReservation(offer.status, offer.depositAmount)

  function move(next: OfferStatus, extra = {}) {
    setError(null)
    startTransition(async () => {
      const res = await updateOfferStatus(offer.id, next, extra)
      if (res.error) setError(res.error)
      else {
        setAccepting(false)
        setRejecting(false)
        onDone()
      }
    })
  }

  function pick(next: OfferStatus) {
    if (next === 'ACEPTADA') return setAccepting(true)
    if (next === 'RECHAZADA') return setRejecting(true)
    move(next)
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-foreground">{EUR(offer.amount)}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: `${OFFER_STATUS_COLORS[offer.status]}1a`,
                color: OFFER_STATUS_COLORS[offer.status],
              }}
            >
              {OFFER_STATUS_LABELS[offer.status]}
            </span>
            {reservation && (
              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                Reserva
              </span>
            )}
          </div>
          <Link
            href={offer.counterpartHref}
            className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:underline"
          >
            {offer.counterpartLabel} <ExternalLink className="h-3 w-3" />
          </Link>
          {offer.depositAmount != null && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Señal: {EUR(offer.depositAmount)}
              {offer.reservedUntil &&
                ` · reserva hasta ${new Date(offer.reservedUntil).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'Europe/Madrid',
                })}`}
            </p>
          )}
          {offer.notes && <p className="mt-1 text-[12px] text-foreground/80">{offer.notes}</p>}
        </div>
      </div>

      {accepting && (
        <div className="mt-3 space-y-2 rounded border border-cyan-200 bg-cyan-50 p-3">
          <p className="text-[11px] font-medium text-cyan-800">
            Aceptar la oferta. Añade la señal para que quede reservado.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              step="100"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="Señal (€)"
              className="h-8 rounded border border-cyan-200 px-2 text-[12px]"
            />
            <input
              type="date"
              value={reservedUntil}
              onChange={(e) => setReservedUntil(e.target.value)}
              className="h-8 rounded border border-cyan-200 px-2 text-[12px]"
            />
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
              onClick={() => setRejecting(false)}
              className="rounded border border-red-200 px-3 py-1 text-[11px] text-red-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}

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
    </div>
  )
}
