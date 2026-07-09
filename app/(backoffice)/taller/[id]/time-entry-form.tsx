'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addTimeEntry, deleteTimeEntry } from '../actions'

interface TimeEntry {
  id: string
  description: string
  hours: number
  hourlyRate: number
  workDate: Date
  workerName: string | null
  workerId: string
}

interface Props {
  woId: string
  entries: TimeEntry[]
  currentUserId: string
  isAdmin: boolean
  isClosed: boolean
}

export function TimeEntrySection({ woId, entries, currentUserId, isAdmin, isClosed }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [hours, setHours] = useState('')
  const [hourlyRate, setHourlyRate] = useState('30')
  const [description, setDescription] = useState('')
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10))

  const totalCost = entries.reduce((sum, e) => sum + e.hours * e.hourlyRate, 0)

  const inputClass =
    'h-9 w-full rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20'

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await addTimeEntry(woId, { hours, hourlyRate, description, workDate })
      if (result.ok) {
        toast.success('Horas imputadas.')
        setShowForm(false)
        setHours('')
        setDescription('')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDelete(entryId: string) {
    if (!confirm('¿Eliminar esta entrada de horas?')) return
    startTransition(async () => {
      const result = await deleteTimeEntry(entryId)
      if (result.ok) {
        toast.success('Entrada eliminada.')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-cn-ink-700">
            Total mano de obra:{' '}
            <span className="font-bold text-cn-teal-900">
              {totalCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </span>
          </p>
        </div>
        {!isClosed && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            + Imputar horas
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="space-y-3 rounded-xl border border-cn-line bg-cn-cream-50 p-4"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">Horas</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
                placeholder="2.5"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">€/h</label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">Descripción</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Revisión sistema de frenos"
                className={inputClass}
              />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-cn-ink-700">
                Fecha de trabajo
              </label>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                required
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

      {entries.length === 0 ? (
        <p className="text-cn-ink-400 py-4 text-center text-sm">Sin horas imputadas.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cn-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-cn-line bg-cn-cream-50">
                <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">Descripción</th>
                <th className="px-4 py-2.5 text-right font-medium text-cn-ink-500">Horas</th>
                <th className="px-4 py-2.5 text-right font-medium text-cn-ink-500">€/h</th>
                <th className="px-4 py-2.5 text-right font-medium text-cn-ink-500">Total</th>
                <th className="hidden px-4 py-2.5 text-left font-medium text-cn-ink-500 sm:table-cell">
                  Técnico
                </th>
                <th className="hidden px-4 py-2.5 text-left font-medium text-cn-ink-500 sm:table-cell">
                  Fecha
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-cn-line last:border-0">
                  <td className="px-4 py-3 text-cn-ink-700">{entry.description}</td>
                  <td className="px-4 py-3 text-right">{entry.hours}</td>
                  <td className="px-4 py-3 text-right">{entry.hourlyRate}€</td>
                  <td className="px-4 py-3 text-right font-medium text-cn-teal-900">
                    {(entry.hours * entry.hourlyRate).toLocaleString('es-ES', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </td>
                  <td className="hidden px-4 py-3 text-cn-ink-500 sm:table-cell">
                    {entry.workerName ?? '—'}
                  </td>
                  <td className="text-cn-ink-400 hidden px-4 py-3 sm:table-cell">
                    {new Date(entry.workDate).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(isAdmin || entry.workerId === currentUserId) && !isClosed && (
                      <button
                        onClick={() => handleDelete(entry.id)}
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
