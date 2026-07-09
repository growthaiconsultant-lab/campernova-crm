'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import type { VehicleCostCategory } from '@prisma/client'
import {
  createVehicleCost,
  deleteVehicleCost,
} from '@/app/(backoffice)/vendedores/[id]/cost-actions'

interface Cost {
  id: string
  category: VehicleCostCategory
  description: string
  amount: number
  supplier: string | null
  invoiceUrl: string | null
  createdAt: Date
  createdBy: { id: string; name: string } | null
}

interface Props {
  vehicleId: string
  costs: Cost[]
  currentUserId: string
  isAdmin: boolean
}

const CATEGORY_LABELS: Record<VehicleCostCategory, string> = {
  PIEZAS: 'Piezas',
  MANO_OBRA_TALLER: 'Mano obra',
  INSTALACION: 'Instalación',
  LIMPIEZA: 'Limpieza',
  MARKETING: 'Marketing',
  CUSTODIA: 'Custodia',
  POSTVENTA: 'Postventa',
  OTRO: 'Otro',
}

const CATEGORY_COLORS: Record<VehicleCostCategory, string> = {
  PIEZAS: 'bg-blue-100 text-blue-700',
  MANO_OBRA_TALLER: 'bg-purple-100 text-purple-700',
  INSTALACION: 'bg-teal-100 text-teal-700',
  LIMPIEZA: 'bg-green-100 text-green-700',
  MARKETING: 'bg-orange-100 text-orange-700',
  CUSTODIA: 'bg-yellow-100 text-yellow-700',
  POSTVENTA: 'bg-red-100 text-red-700',
  OTRO: 'bg-gray-100 text-gray-700',
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as VehicleCostCategory[]

export function VehicleCostsTable({ vehicleId, costs, currentUserId, isAdmin }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [filterCat, setFilterCat] = useState<VehicleCostCategory | ''>('')

  // Form state
  const [category, setCategory] = useState<VehicleCostCategory>('OTRO')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [supplier, setSupplier] = useState('')

  const filtered = filterCat ? costs.filter((c) => c.category === filterCat) : costs

  function handleAddCost(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createVehicleCost(vehicleId, {
        category,
        description,
        amount: parseFloat(amount),
        supplier: supplier || undefined,
      })
      if (result.ok) {
        toast.success('Coste añadido.')
        setShowForm(false)
        setDescription('')
        setAmount('')
        setSupplier('')
        setCategory('OTRO')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDelete(costId: string) {
    if (!confirm('¿Eliminar este coste?')) return
    startTransition(async () => {
      const result = await deleteVehicleCost(costId)
      if (result.ok) {
        toast.success('Coste eliminado.')
      } else {
        toast.error(result.error)
      }
    })
  }

  const inputClass =
    'h-9 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20'

  return (
    <div className="space-y-3">
      {/* Filtro + botón añadir */}
      <div className="flex items-center justify-between gap-3">
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value as VehicleCostCategory | '')}
          className="h-9 rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir coste manual
        </button>
      </div>

      {/* Form añadir */}
      {showForm && (
        <form
          onSubmit={handleAddCost}
          className="space-y-3 rounded-xl border border-cn-line bg-cn-cream-50 p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as VehicleCostCategory)}
                className={inputClass}
                required
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">Importe (€)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="150.00"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">Descripción</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Limpieza completa interior y exterior"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">
                Proveedor (opcional)
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Taller Manolo"
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-cn-line px-3 py-1.5 text-sm text-cn-ink-500 hover:bg-cn-cream-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Guardar coste
            </button>
          </div>
        </form>
      )}

      {/* Tabla */}
      {filtered.length === 0 ? (
        <p className="text-cn-ink-400 py-6 text-center text-sm">Sin costes imputados.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-cn-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cn-line bg-cn-cream-50">
                <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">Categoría</th>
                <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">Descripción</th>
                <th className="px-4 py-2.5 text-right font-medium text-cn-ink-500">Importe</th>
                <th className="hidden px-4 py-2.5 text-left font-medium text-cn-ink-500 sm:table-cell">
                  Proveedor
                </th>
                <th className="hidden px-4 py-2.5 text-left font-medium text-cn-ink-500 sm:table-cell">
                  Por
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((cost) => (
                <tr key={cost.id} className="border-b border-cn-line last:border-0">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[cost.category]}`}
                    >
                      {CATEGORY_LABELS[cost.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cn-ink-700">
                    {cost.description}
                    {cost.invoiceUrl && (
                      <a
                        href={cost.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1.5 inline-flex items-center text-cn-teal-700 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-cn-teal-900">
                    {cost.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td className="hidden px-4 py-3 text-cn-ink-500 sm:table-cell">
                    {cost.supplier ?? '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-cn-ink-500 sm:table-cell">
                    {cost.createdBy?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(isAdmin || cost.createdBy?.id === currentUserId) && (
                      <button
                        onClick={() => handleDelete(cost.id)}
                        disabled={isPending}
                        className="text-cn-ink-400 rounded p-1 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
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
