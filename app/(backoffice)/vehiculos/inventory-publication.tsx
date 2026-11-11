'use client'

import Link from 'next/link'
import { useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { InventoryPriceForm } from './inventory-price-editor'

type Props = {
  title: string
  pending: { field: string; message: string }[]
  missingPrice: boolean
  preparationHref: string
  savePrice?: (value: string) => Promise<{ ok: true } | { ok: false; error: string }>
  publish: () => Promise<{ ok: true } | { error: { formErrors: string[] } }>
}

export function InventoryPublication({
  title,
  pending,
  missingPrice,
  preparationHref,
  savePrice,
  publish,
}: Props) {
  const [review, setReview] = useState(false)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const working = useRef(false)
  const panelId = useId()
  const router = useRouter()

  async function confirm() {
    if (working.current) return
    working.current = true
    setBusy(true)
    setError('')
    try {
      const result = await publish()
      if ('error' in result) {
        setError(result.error.formErrors.join('\n'))
      } else {
        toast.success(title + ' · Publicado en la web')
        setReview(false)
      }
      router.refresh()
    } catch {
      setError(
        'No se pudo confirmar la publicación. Actualiza la tarjeta para comprobar su estado.'
      )
      router.refresh()
    } finally {
      working.current = false
      setBusy(false)
    }
  }

  const priceForm = missingPrice && savePrice && editing
  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || Boolean(priceForm)}
          aria-controls={panelId}
          aria-expanded={review}
          onClick={() => {
            setReview(!review)
            setError('')
          }}
        >
          Publicar en la web
        </Button>
        {!review && !priceForm && missingPrice && savePrice && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Añadir precio
          </Button>
        )}
      </div>

      {review && (
        <section
          id={panelId}
          aria-label={'Publicación de ' + title}
          className="space-y-3 rounded-md border border-line bg-muted/40 p-3 text-sm"
        >
          {missingPrice ? (
            <div>
              <p className="font-semibold">El anuncio saldrá sin precio de venta.</p>
              <p>En la web aparecerá «Precio a consultar».</p>
              {!savePrice && (
                <p className="mt-1 text-muted-foreground">Administración puede añadir el precio.</p>
              )}
            </div>
          ) : (
            <p className="font-medium">
              {pending.length
                ? 'El expediente tiene pendientes para publicar.'
                : 'El vehículo está listo para publicar.'}
            </p>
          )}

          {pending.length > 0 && (
            <details>
              <summary className="cursor-pointer font-medium text-brand underline">
                {pending.length === 1 ? 'Ver 1 pendiente' : 'Ver ' + pending.length + ' pendientes'}
              </summary>
              <ul className="my-2 list-disc space-y-1 pl-5">
                {pending.map((item) => (
                  <li key={item.field}>{item.message}</li>
                ))}
              </ul>
              <Link href={preparationHref} className="text-brand underline">
                Completar el expediente
              </Link>
            </details>
          )}

          {!priceForm && (
            <div className="flex flex-wrap gap-2">
              {missingPrice && savePrice && (
                <Button type="button" size="sm" disabled={busy} onClick={() => setEditing(true)}>
                  Añadir precio
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant={pending.length ? 'outline' : 'default'}
                disabled={busy}
                onClick={confirm}
              >
                {busy
                  ? 'Publicando…'
                  : pending.length
                    ? 'Publicar de todas formas'
                    : 'Confirmar publicación'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setReview(false)
                  setError('')
                }}
              >
                Cancelar
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="whitespace-pre-line text-destructive">
              {error}
            </p>
          )}
        </section>
      )}
      {priceForm && savePrice && (
        <InventoryPriceForm label={title} savePrice={savePrice} onClose={() => setEditing(false)} />
      )}
    </div>
  )
}
