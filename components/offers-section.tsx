'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, HandCoins } from 'lucide-react'
import { createOffer } from '@/app/(backoffice)/ofertas/actions'
import { BuyerOfferGroups } from './buyer-offer-groups'
import type { OfferStatus } from '@prisma/client'

export type OfferRow = {
  id: string
  amount: number
  depositAmount: number | null
  status: OfferStatus
  reservedUntil: string | null
  notes: string | null
  createdAt?: string
  counterpartLabel: string
  counterpartHref: string
}

type Candidate = { id: string; label: string }

type Props = {
  side: 'buyer' | 'vehicle'
  fixedId: string
  candidates: Candidate[]
  offers: OfferRow[]
  initialDay?: string
}

export function OffersSection({ side, fixedId, candidates, offers, initialDay }: Props) {
  const router = useRouter()
  const formId = useId()
  const [pending, setPending] = useState(false)
  const [adding, setAdding] = useState(false)
  const [counterpart, setCounterpart] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submitNew() {
    if (pending) return
    if (!counterpart) return setError(side === 'buyer' ? 'Elige un vehículo' : 'Elige un comprador')
    if (!amount || Number(amount) <= 0) return setError('Indica un importe')
    setError(null)
    const payload =
      side === 'buyer'
        ? { buyerLeadId: fixedId, vehicleId: counterpart }
        : { vehicleId: fixedId, buyerLeadId: counterpart }
    setPending(true)
    try {
      const res = await createOffer({ ...payload, amount: Number(amount), notes })
      if (res.error) setError(res.error)
      else {
        setAdding(false)
        setCounterpart('')
        setAmount('')
        setNotes('')
        router.refresh()
      }
    } catch {
      setError('No se ha podido confirmar el registro. Comprueba la lista de ofertas.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-4">
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

      <div className="p-4">
        {adding && (
          <div className="mb-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={formId + '-counterpart'}
                  className="mb-1 block text-[11px] font-medium text-muted-foreground"
                >
                  {side === 'buyer' ? 'Vehículo' : 'Comprador'}
                </label>
                <select
                  id={formId + '-counterpart'}
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
                <label
                  htmlFor={formId + '-amount'}
                  className="mb-1 block text-[11px] font-medium text-muted-foreground"
                >
                  Importe ofertado (€)
                </label>
                <input
                  type="number"
                  min={0}
                  id={formId + '-amount'}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej: 38000"
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px]"
                />
              </div>
            </div>
            <input
              aria-label="Notas de la oferta"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas (condiciones, financiación pendiente…)"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px]"
            />
            {error && (
              <p role="alert" className="text-[12px] text-red-600">
                {error}
              </p>
            )}
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
                disabled={pending}
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
            {candidates.length === 0 &&
              (side === 'buyer'
                ? ' Asocia un vehículo disponible para registrar la primera oferta.'
                : ' Genera un match primero para poder registrar una oferta.')}
          </p>
        ) : (
          <BuyerOfferGroups
            counterpart={side === 'buyer' ? 'vehículo' : 'comprador'}
            offers={offers}
            initialDay={initialDay}
            onDone={() => router.refresh()}
          />
        )}
      </div>
    </div>
  )
}
