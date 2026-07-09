'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createWorkOrder } from '../actions'

interface Vehicle {
  id: string
  brand: string
  model: string
  year: number | null
  sellerLeadName: string | null
}

interface User {
  id: string
  name: string
}

interface Props {
  vehicles: Vehicle[]
  users: User[]
  initialVehicleId?: string
  initialKind?: 'REPARACION' | 'MEJORA'
}

export function WorkOrderForm({
  vehicles,
  users,
  initialVehicleId = '',
  initialKind = 'REPARACION',
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [vehicleId, setVehicleId] = useState(initialVehicleId)
  const [kind, setKind] = useState<'REPARACION' | 'MEJORA'>(initialKind)
  const [description, setDescription] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [approvalLimit, setApprovalLimit] = useState('500')
  const [notes, setNotes] = useState('')

  const inputClass =
    'h-10 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createWorkOrder({
        vehicleId,
        kind,
        description,
        assignedToId: assignedToId || null,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        approvalLimit: approvalLimit ? parseFloat(approvalLimit) : 500,
        notes: notes || null,
      })
      if (result.ok) {
        toast.success('Orden de taller creada.')
        router.push(`/taller/${result.data!.id}`)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipo de trabajo (F4) */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-cn-ink-700">Tipo de trabajo</label>
        <div className="flex gap-2">
          {(
            [
              ['REPARACION', 'Reparación', 'Corregir un problema'],
              ['MEJORA', 'Mejora', 'Añadir valor al vehículo'],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              title={hint}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                kind === value
                  ? 'border-primary bg-primary text-white'
                  : 'border-cn-line text-cn-ink-500 hover:border-primary/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Vehículo */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-cn-ink-700">
          Vehículo <span className="text-red-500">*</span>
        </label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          required
          className={inputClass}
        >
          <option value="">Selecciona un vehículo…</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.brand} {v.model} {v.year ?? ''}
              {v.sellerLeadName ? ` — ${v.sellerLeadName}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Descripción */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-cn-ink-700">
          Descripción del trabajo <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="Revisión pre-venta completa: mecánica, agua, gas, electricidad…"
          className="w-full rounded-lg border border-cn-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Asignado a */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-cn-ink-700">Asignado a</label>
          <select
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            className={inputClass}
          >
            <option value="">Sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Horas estimadas */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-cn-ink-700">
            Horas estimadas
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            placeholder="8"
            className={inputClass}
          />
        </div>

        {/* Coste estimado */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-cn-ink-700">
            Coste estimado (€)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            placeholder="350"
            className={inputClass}
          />
        </div>

        {/* Límite de aprobación */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-cn-ink-700">
            Límite de aprobación (€)
          </label>
          <input
            type="number"
            step="1"
            min="0"
            value={approvalLimit}
            onChange={(e) => setApprovalLimit(e.target.value)}
            placeholder="500"
            className={inputClass}
          />
          <p className="text-cn-ink-400 mt-1 text-xs">
            Si el coste estimado supera este límite, se requerirá aprobación del CEO.
          </p>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-cn-ink-700">Notas internas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Observaciones adicionales para el mecánico…"
          className="w-full rounded-lg border border-cn-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-2 border-t border-cn-line pt-4">
        <a
          href="/taller"
          className="inline-flex h-10 items-center rounded-lg border border-cn-line px-4 text-sm text-cn-ink-500 hover:bg-cn-cream-50"
        >
          Cancelar
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Crear orden
        </button>
      </div>
    </form>
  )
}
