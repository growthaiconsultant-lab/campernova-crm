'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatEur } from '@/lib/format/currency'
import { updateOfferStatus } from '../ofertas/actions'
import { discardInventoryVehicle } from './discard-action'

type Props = {
  vehicleId: string
  status: 'NUEVO' | 'TASADO' | 'PUBLICADO'
  title: string
  saleHref: string
  published: boolean
  offers: { id: string; buyer: string; amount: number }[]
  canDiscard: boolean
}

export function InventorySaleActions({
  vehicleId,
  status,
  title,
  saleHref,
  published,
  offers,
  canDiscard,
}: Props) {
  const router = useRouter()
  const [panel, setPanel] = useState<'reserve' | 'discard' | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  function open(next: typeof panel) {
    setError('')
    setPanel(next)
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (working.current || !panel) return
    const form = new FormData(event.currentTarget)
    const reserving = panel === 'reserve'
    working.current = true
    setBusy(true)
    setError('')
    try {
      const deposit = String(form.get('deposit') ?? '')
      const result = reserving
        ? await updateOfferStatus(String(form.get('offer')), 'ACEPTADA', {
            expectedVehicleId: vehicleId,
            depositAmount: deposit ? Number(deposit) : null,
            reservedUntil: String(form.get('until') ?? '') || null,
          })
        : await discardInventoryVehicle(vehicleId, status, String(form.get('reason') ?? ''))
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      toast.success(title + (reserving ? ' · Reserva confirmada' : ' · Vehículo descartado'))
      open(null)
      router.refresh()
    } catch {
      setError('No se pudo confirmar el cambio. Comprueba el estado del vehículo.')
    } finally {
      working.current = false
      setBusy(false)
    }
  }
  if (!panel)
    return (
      <div className="flex flex-wrap items-center gap-2">
        {published && (
          <Button type="button" size="sm" onClick={() => open('reserve')}>
            Reservar vehículo
          </Button>
        )}
        {canDiscard && (
          <button
            type="button"
            className="rounded py-1.5 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => open('discard')}
          >
            Descartar vehículo
          </button>
        )}
      </div>
    )
  return (
    <form
      onSubmit={submit}
      className="w-full min-w-0 rounded-md border bg-muted/40 p-3"
      aria-label={panel === 'reserve' ? 'Reservar ' + title : 'Descartar ' + title}
    >
      <fieldset disabled={busy} className="space-y-2">
        <strong className="text-sm">
          {panel === 'reserve' ? 'Reservar ' + title : '¿Descartar ' + title + '?'}
        </strong>
        {panel === 'reserve' ? (
          offers.length ? (
            <>
              <label className="grid gap-1 text-sm">
                Oferta y comprador
                <select
                  name="offer"
                  required
                  defaultValue={offers.length === 1 ? offers[0].id : ''}
                  className="w-full rounded-md border bg-background p-2"
                >
                  {offers.length > 1 && <option value="">Selecciona la oferta</option>}
                  {offers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.buyer} · {formatEur(o.amount, 'cents')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Señal recibida (€), si la hay
                <Input
                  type="number"
                  name="deposit"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  inputMode="decimal"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Reservado hasta (opcional)
                <Input type="date" name="until" />
              </label>
            </>
          ) : (
            <p className="text-sm">
              Primero registra una oferta con el comprador y el importe.{' '}
              <Link className="text-brand underline" href={saleHref}>
                Crear oferta en Venta
              </Link>
            </p>
          )
        ) : (
          <>
            <p className="text-sm">
              Solo se descartará este vehículo. El contacto del vendedor conserva su estado.
              {published ? ' El anuncio también se retirará de la web CampersNova.' : ''}
            </p>
            <label className="grid gap-1 text-sm">
              Motivo (opcional)
              <Textarea name="reason" maxLength={500} rows={2} />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => open(null)}>
            Cancelar
          </Button>
          {(panel === 'discard' || offers.length > 0) && (
            <Button
              type="submit"
              size="sm"
              variant={panel === 'discard' ? 'destructive' : 'default'}
            >
              {busy
                ? 'Guardando…'
                : panel === 'reserve'
                  ? 'Confirmar reserva'
                  : 'Confirmar descarte'}
            </Button>
          )}
        </div>
      </fieldset>
    </form>
  )
}
