'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateNaveLocation } from '@/app/(backoffice)/vendedores/[id]/cost-actions'

interface Props {
  vehicleId: string
  entryDate: Date | null
  naveLocation: string | null
}

export function NaveLocationField({ vehicleId, entryDate, naveLocation }: Props) {
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState(entryDate ? entryDate.toISOString().slice(0, 10) : '')
  const [location, setLocation] = useState(naveLocation ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateNaveLocation(vehicleId, {
        entryDate: date || null,
        naveLocation: location || null,
      })
      if (result.ok) {
        toast.success('Ubicación en nave guardada.')
      } else {
        toast.error(result.error)
      }
    })
  }

  const inputClass =
    'h-9 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cn-teal-900/20'

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-cn-ink-700">
          Fecha de entrada a nave
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-cn-ink-700">Ubicación física</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Fila A, posición 3"
          className={inputClass}
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="h-9 rounded-lg bg-cn-teal-900 px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </form>
  )
}
