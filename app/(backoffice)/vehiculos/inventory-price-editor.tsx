'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatEur } from '@/lib/format/currency'

type Props = {
  label: string
  savePrice: (price: string) => Promise<{ ok: true } | { ok: false; error: string }>
}

export function InventoryPriceEditor({ label, savePrice }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="px-3 pb-3">
      {open ? (
        <InventoryPriceForm label={label} savePrice={savePrice} onClose={() => setOpen(false)} />
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Añadir precio
        </Button>
      )}
    </div>
  )
}

export function InventoryPriceForm({ label, savePrice, onClose }: Props & { onClose: () => void }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const working = useRef(false)
  const router = useRouter()
  return (
    <form
      aria-label={'Añadir precio a ' + label}
      onSubmit={async (event) => {
        event.preventDefault()
        if (working.current) return
        const price = String(new FormData(event.currentTarget).get('price') ?? '')
        working.current = true
        setPending(true)
        setError('')
        try {
          const result = await savePrice(price)
          if (!result.ok) {
            setError(result.error)
            return
          }
          toast.success(
            label +
              ' · Precio de venta guardado: ' +
              formatEur(Number(price.replace(',', '.')), 'cents')
          )
          onClose()
          router.refresh()
        } catch {
          setError('No se pudo confirmar el guardado. Puedes volver a intentarlo.')
        } finally {
          working.current = false
          setPending(false)
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-2">
        <label className="grid gap-1 text-sm font-medium">
          Precio de venta (€)
          <Input
            type="number"
            inputMode="decimal"
            name="price"
            min="0.01"
            max="99999999.99"
            step="0.01"
            required
            autoFocus
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            {pending ? 'Guardando…' : 'Guardar precio'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </fieldset>
    </form>
  )
}
