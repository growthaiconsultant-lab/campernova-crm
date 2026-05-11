'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateChecklistItem } from '../actions'
import type { ChecklistItemResult } from '@prisma/client'

const RESULT_OPTIONS: { value: ChecklistItemResult; label: string; color: string }[] = [
  { value: 'PENDIENTE', label: 'Pendiente', color: 'text-gray-500' },
  { value: 'OK', label: 'OK', color: 'text-green-600' },
  { value: 'NECESITA_REPARACION', label: 'Necesita reparación', color: 'text-red-600' },
  { value: 'NO_APLICA', label: 'No aplica', color: 'text-cn-ink-400' },
]

interface Props {
  id: string
  item: string
  result: ChecklistItemResult
  notes: string | null
  isClosed: boolean
}

export function ChecklistItemRow({
  id,
  item,
  result: initialResult,
  notes: initialNotes,
  isClosed,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ChecklistItemResult>(initialResult)
  const [notes, setNotes] = useState(initialNotes ?? '')

  function handleChange(newResult: ChecklistItemResult) {
    setResult(newResult)
    startTransition(async () => {
      const r = await updateChecklistItem(id, { result: newResult, notes: notes || null })
      if (!r.ok) toast.error(r.error)
    })
  }

  function handleNotesBlur() {
    startTransition(async () => {
      const r = await updateChecklistItem(id, { result, notes: notes || null })
      if (!r.ok) toast.error(r.error)
    })
  }

  const currentOption = RESULT_OPTIONS.find((o) => o.value === result)

  return (
    <tr className="border-b border-cn-line last:border-0">
      <td className="py-2.5 pr-4 text-sm text-cn-ink-700">{item}</td>
      <td className="py-2.5 pr-4">
        {isClosed ? (
          <span className={`text-sm font-medium ${currentOption?.color}`}>
            {currentOption?.label}
          </span>
        ) : (
          <select
            value={result}
            onChange={(e) => handleChange(e.target.value as ChecklistItemResult)}
            disabled={isPending}
            className={`h-8 rounded-md border border-cn-line bg-white px-2 text-xs focus:outline-none disabled:opacity-60 ${currentOption?.color}`}
          >
            {RESULT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="py-2.5">
        {isClosed ? (
          <span className="text-cn-ink-400 text-xs">{notes || '—'}</span>
        ) : (
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            disabled={isPending}
            placeholder="Notas…"
            className="h-8 w-full rounded-md border border-cn-line bg-white px-2 text-xs focus:outline-none disabled:opacity-60"
          />
        )}
      </td>
    </tr>
  )
}
