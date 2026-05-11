'use client'

import { useState, useTransition } from 'react'
import { createTicket } from '../actions'

interface Props {
  warrantyId: string
  onCreated?: () => void
}

export function CreateTicketForm({ warrantyId, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const data = {
      warrantyId,
      title: fd.get('title') as string,
      description: fd.get('description') as string,
      priority: fd.get('priority') as string,
      dueAt: (fd.get('dueAt') as string) || null,
    }
    startTransition(async () => {
      const res = await createTicket(data)
      if (!res.ok) {
        setError(res.error)
      } else {
        setOpen(false)
        onCreated?.()
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-lg bg-cn-teal-900 px-4 text-sm font-medium text-white hover:opacity-90"
      >
        + Nuevo ticket
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-cn-line bg-white p-5"
    >
      <h3 className="font-semibold">Nuevo ticket de incidencia</h3>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-1.5">
        <label className="block text-sm font-medium">
          Título <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          required
          placeholder="Descripción breve del problema"
          className="h-9 w-full rounded-lg border border-cn-line px-3 text-sm focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium">
          Descripción <span className="text-red-500">*</span>
        </label>
        <textarea
          name="description"
          required
          rows={3}
          placeholder="Detalla el problema…"
          className="w-full rounded-lg border border-cn-line px-3 py-2 text-sm focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Prioridad</label>
          <select
            name="priority"
            defaultValue="MEDIA"
            className="h-9 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none"
          >
            <option value="BAJA">Baja</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
            <option value="CRITICA">Crítica</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Fecha límite</label>
          <input
            name="dueAt"
            type="date"
            className="h-9 w-full rounded-lg border border-cn-line px-3 text-sm focus:outline-none"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-cn-line pt-4">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex h-9 items-center rounded-lg border border-cn-line px-4 text-sm font-medium hover:bg-cn-cream-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 items-center rounded-lg bg-cn-teal-900 px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Creando…' : 'Crear ticket'}
        </button>
      </div>
    </form>
  )
}
