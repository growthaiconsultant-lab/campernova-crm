'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ExternalLink } from 'lucide-react'
import { addPart, deletePart } from '../actions'

interface Part {
  id: string
  name: string
  quantity: number
  unitCost: number
  supplier: string | null
  invoiceUrl: string | null
}

interface Props {
  woId: string
  parts: Part[]
  isAdmin: boolean
  isClosed: boolean
}

export function PartsSection({ woId, parts, isAdmin, isClosed }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [supplier, setSupplier] = useState('')
  const [invoiceUrl, setInvoiceUrl] = useState('')

  const totalCost = parts.reduce((sum, p) => sum + p.quantity * p.unitCost, 0)

  const inputClass =
    'h-9 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20'

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await addPart(woId, {
        name,
        quantity,
        unitCost,
        supplier: supplier || null,
        invoiceUrl: invoiceUrl || null,
      })
      if (result.ok) {
        toast.success('Pieza añadida.')
        setShowForm(false)
        setName('')
        setQuantity('1')
        setUnitCost('')
        setSupplier('')
        setInvoiceUrl('')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDelete(partId: string) {
    if (!confirm('¿Eliminar esta pieza?')) return
    startTransition(async () => {
      const result = await deletePart(partId)
      if (result.ok) {
        toast.success('Pieza eliminada.')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-cn-ink-700">
          Total piezas:{' '}
          <span className="font-bold text-cn-teal-900">
            {totalCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </span>
        </p>
        {!isClosed && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            + Añadir pieza
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="space-y-3 rounded-xl border border-cn-line bg-cn-cream-50 p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">
                Nombre de la pieza
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Filtro de aceite"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">Cantidad</label>
              <input
                type="number"
                step="1"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">
                Coste unitario (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                required
                placeholder="45.00"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">Proveedor</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="AutoRepuestos BCN"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">URL factura</label>
              <input
                type="url"
                value={invoiceUrl}
                onChange={(e) => setInvoiceUrl(e.target.value)}
                placeholder="https://…"
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-cn-line px-3 py-1.5 text-sm text-cn-ink-500 hover:bg-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </form>
      )}

      {parts.length === 0 ? (
        <p className="text-cn-ink-400 py-4 text-center text-sm">Sin piezas registradas.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cn-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-cn-line bg-cn-cream-50">
                <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">Pieza</th>
                <th className="px-4 py-2.5 text-right font-medium text-cn-ink-500">Cant.</th>
                <th className="px-4 py-2.5 text-right font-medium text-cn-ink-500">€/u</th>
                <th className="px-4 py-2.5 text-right font-medium text-cn-ink-500">Total</th>
                <th className="hidden px-4 py-2.5 text-left font-medium text-cn-ink-500 sm:table-cell">
                  Proveedor
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {parts.map((part) => (
                <tr key={part.id} className="border-b border-cn-line last:border-0">
                  <td className="px-4 py-3 text-cn-ink-700">
                    {part.name}
                    {part.invoiceUrl && (
                      <a
                        href={part.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1.5 inline-flex items-center text-cn-teal-700 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{part.quantity}</td>
                  <td className="px-4 py-3 text-right">
                    {part.unitCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-cn-teal-900">
                    {(part.quantity * part.unitCost).toLocaleString('es-ES', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </td>
                  <td className="hidden px-4 py-3 text-cn-ink-500 sm:table-cell">
                    {part.supplier ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin && !isClosed && (
                      <button
                        onClick={() => handleDelete(part.id)}
                        disabled={isPending}
                        className="text-cn-ink-400 rounded p-1 text-xs hover:text-red-600 disabled:opacity-50"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
