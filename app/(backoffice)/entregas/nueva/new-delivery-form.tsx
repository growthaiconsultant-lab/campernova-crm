'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createDelivery } from '../actions'

interface Operation {
  offerId: string
  vehicleId: string
  buyerLeadId: string
  label: string
}

interface User {
  id: string
  name: string
}

interface Props {
  operations: Operation[]
  users: User[]
}

export function NewDeliveryForm({ operations, users }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const offerId = fd.get('offerId') as string
    const op = operations.find((o) => o.offerId === offerId)
    if (!op) {
      setError('Selecciona una operación válida.')
      return
    }
    const data = {
      vehicleId: op.vehicleId,
      buyerLeadId: op.buyerLeadId,
      offerId: op.offerId,
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

      {operations.length === 0 ? (
        <div className="rounded-lg bg-cn-cream-50 px-4 py-3 text-sm text-muted-foreground">
          No hay ventas cerradas pendientes de entrega. Una entrega se programa desde una oferta
          convertida con el vehículo reservado.
        </div>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="offerId" className="block text-sm font-medium">
            Operación (venta cerrada) <span className="text-red-500">*</span>
          </label>
          <select
            id="offerId"
            name="offerId"
            required
            className="h-10 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none"
          >
            <option value="">Seleccionar operación…</option>
            {operations.map((o) => (
              <option key={o.offerId} value={o.offerId}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

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
          disabled={isPending || operations.length === 0}
          className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Creando…' : 'Crear entrega'}
        </button>
      </div>
    </form>
  )
}
