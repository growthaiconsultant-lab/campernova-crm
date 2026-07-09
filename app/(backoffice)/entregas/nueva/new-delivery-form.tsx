'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createDelivery } from '../actions'

interface Vehicle {
  id: string
  brand: string
  model: string
  year: number
}

interface Buyer {
  id: string
  name: string
}

interface User {
  id: string
  name: string
}

interface Props {
  vehicles: Vehicle[]
  buyers: Buyer[]
  users: User[]
}

export function NewDeliveryForm({ vehicles, buyers, users }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      vehicleId: fd.get('vehicleId') as string,
      buyerLeadId: fd.get('buyerLeadId') as string,
      scheduledAt: fd.get('scheduledAt') as string,
      responsableId: (fd.get('responsableId') as string) || null,
      notes: (fd.get('notes') as string) || null,
    }

    startTransition(async () => {
      const res = await createDelivery(data)
      if (!res.ok) {
        setError(res.error)
      } else {
        router.push(`/entregas/${res.data!.id}`)
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border border-cn-line bg-white p-6"
    >
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-1.5">
        <label htmlFor="vehicleId" className="block text-sm font-medium">
          Vehículo <span className="text-red-500">*</span>
        </label>
        <select
          id="vehicleId"
          name="vehicleId"
          required
          className="h-10 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none"
        >
          <option value="">Seleccionar vehículo…</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.brand} {v.model} ({v.year})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="buyerLeadId" className="block text-sm font-medium">
          Comprador <span className="text-red-500">*</span>
        </label>
        <select
          id="buyerLeadId"
          name="buyerLeadId"
          required
          className="h-10 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none"
        >
          <option value="">Seleccionar comprador…</option>
          {buyers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="scheduledAt" className="block text-sm font-medium">
          Fecha y hora <span className="text-red-500">*</span>
        </label>
        <input
          id="scheduledAt"
          name="scheduledAt"
          type="datetime-local"
          required
          className="h-10 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="responsableId" className="block text-sm font-medium">
          Responsable (Javi)
        </label>
        <select
          id="responsableId"
          name="responsableId"
          className="h-10 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none"
        >
          <option value="">Sin asignar</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="block text-sm font-medium">
          Notas internas
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Observaciones, instrucciones especiales…"
          className="w-full rounded-lg border border-cn-line bg-white px-3 py-2.5 text-sm focus:outline-none"
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-cn-line pt-4">
        <a
          href="/entregas"
          className="inline-flex h-10 items-center rounded-lg border border-cn-line px-4 text-sm font-medium hover:bg-cn-cream-50"
        >
          Cancelar
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Creando…' : 'Crear entrega'}
        </button>
      </div>
    </form>
  )
}
