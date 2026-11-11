'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { savePortalListing } from '@/app/(backoffice)/vendedores/[id]/portal-actions'
import { offerDateLabel, offerDay } from '@/lib/buyer-offers'
import {
  isPortalUrl,
  portalLabels,
  type SalePortal,
  type PortalListingView,
} from '@/lib/portal-listings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  sellerId: string
  vehicleId: string
  channel: SalePortal
  listing: PortalListingView | null
  draft: boolean
  editable: boolean
  children?: React.ReactNode
}
export function SellerPortalListing({
  sellerId,
  vehicleId,
  channel,
  listing,
  draft,
  editable,
  children,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [stale, setStale] = useState(false)
  const working = useRef(false)
  const label = portalLabels[channel]
  const active = listing && !listing.withdrawn
  async function save(action: 'publish' | 'withdraw', form?: FormData) {
    if (working.current) return
    const url = String(form?.get('url') ?? '').trim()
    if (action === 'publish' && !isPortalUrl(channel, url)) {
      setError('Introduce el enlace HTTPS del anuncio en ' + label + '.')
      return
    }
    working.current = true
    setBusy(true)
    setError('')
    try {
      const result = await savePortalListing(sellerId, vehicleId, {
        action,
        channel,
        revision: listing?.revision ?? 0,
        url,
        publishedOn: form?.get('publishedOn'),
      })
      if ('error' in result && result.error) {
        setError(result.error ?? 'Revisa los datos del anuncio.')
        setStale('stale' in result && result.stale === true)
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError('No se pudo confirmar el cambio. Puedes volver a intentarlo.')
    } finally {
      working.current = false
      setBusy(false)
    }
  }
  return (
    <section aria-label={label} className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <strong>{label}</strong>
            {children && (
              <span
                className={
                  active
                    ? 'rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900'
                    : 'rounded bg-muted px-2 py-0.5 text-xs font-medium'
                }
              >
                {active
                  ? 'Publicado'
                  : listing?.withdrawn
                    ? 'Retirado según el equipo'
                    : 'Sin confirmar'}
              </span>
            )}
          </div>
          {children ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {draft ? 'Texto preparado' : 'Falta preparar el texto del anuncio.'}
            </p>
          ) : (
            <p className="text-sm">
              {active
                ? 'Publicado según el equipo'
                : listing?.withdrawn
                  ? 'Retirado según el equipo'
                  : draft
                    ? 'Texto preparado · Publicación sin confirmar'
                    : 'Sin publicación confirmada'}
            </p>
          )}
          {active && (
            <p className="text-xs text-muted-foreground">
              Publicado el {offerDateLabel(listing.publishedOn)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {children}
          {active && (
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand underline"
            >
              Ver anuncio
            </a>
          )}
          {editable && !open && (
            <Button
              type="button"
              size="sm"
              variant={children && draft && !active ? 'default' : 'outline'}
              onClick={() => {
                setError('')
                setOpen(true)
              }}
            >
              {active ? 'Editar anuncio' : 'Registrar publicación'}
            </Button>
          )}
        </div>
      </div>
      {open && (
        <form
          aria-label={'Publicación en ' + label}
          className="mt-3 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            void save('publish', new FormData(e.currentTarget))
          }}
        >
          <fieldset disabled={busy} className="space-y-3">
            <label className="block text-sm">
              Enlace del anuncio en {label}
              <Input
                name="url"
                type="url"
                required
                maxLength={2048}
                autoFocus
                defaultValue={listing?.url ?? ''}
              />
            </label>
            <label className="block text-sm">
              Fecha de publicación
              <Input
                name="publishedOn"
                type="date"
                required
                max={offerDay(new Date())}
                defaultValue={active ? listing.publishedOn : ''}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={stale}>
                {busy ? 'Guardando…' : 'Guardar publicación'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  setError('')
                }}
              >
                Cancelar
              </Button>
              {active && (
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline"
                  disabled={stale}
                  onClick={() => {
                    if (
                      window.confirm(
                        '¿Registrar que el anuncio ya se ha retirado de ' + label + '?'
                      )
                    )
                      void save('withdraw')
                  }}
                >
                  Marcar como retirado
                </button>
              )}
            </div>
          </fieldset>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}{' '}
          {stale && (
            <button className="underline" type="button" onClick={() => router.refresh()}>
              Actualizar ficha
            </button>
          )}
        </p>
      )}
    </section>
  )
}
