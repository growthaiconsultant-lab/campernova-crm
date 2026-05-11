'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateVehicleEconomics } from '@/app/(backoffice)/vendedores/[id]/cost-actions'

interface Props {
  vehicleId: string
  desiredPrice: number | null
  purchasePrice: number | null
  salePrice: number | null
  marginPercent: number
}

export function VehicleEconomicsForm({
  vehicleId,
  desiredPrice,
  purchasePrice,
  salePrice,
  marginPercent,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [purchase, setPurchase] = useState(purchasePrice?.toString() ?? '')
  const [sale, setSale] = useState(salePrice?.toString() ?? '')
  const [margin, setMargin] = useState(marginPercent.toString())

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateVehicleEconomics(vehicleId, {
        purchasePrice: purchase ? parseFloat(purchase) : null,
        salePrice: sale ? parseFloat(sale) : null,
        marginPercent: parseFloat(margin),
      })
      if (result.ok) {
        toast.success('Datos económicos guardados.')
      } else {
        toast.error(result.error)
      }
    })
  }

  const inputClass =
    'h-10 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cn-teal-900/20'

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {desiredPrice !== null && (
        <div className="sm:col-span-3">
          <p className="text-xs text-cn-ink-500">
            Precio pedido por el vendedor:{' '}
            <span className="font-medium">
              {desiredPrice.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </span>
            <span className="text-cn-ink-400 ml-1">(referencia, no editable aquí)</span>
          </p>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-cn-ink-700">
          Precio compra acordado (€)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={purchase}
          onChange={(e) => setPurchase(e.target.value)}
          placeholder="28500"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-cn-ink-700">
          Precio venta público (€)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={sale}
          onChange={(e) => setSale(e.target.value)}
          placeholder="32000"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-cn-ink-700">
          Margen objetivo (%)
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex justify-end sm:col-span-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-cn-teal-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          Guardar datos económicos
        </button>
      </div>
    </form>
  )
}
