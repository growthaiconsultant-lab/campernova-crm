'use client'

import { useTransition } from 'react'
import { updateDeliveryChecklistItem } from '../actions'
import type { DeliveryChecklistCategory, DeliveryChecklistResult } from '@prisma/client'

interface ChecklistItem {
  id: string
  category: DeliveryChecklistCategory
  item: string
  result: DeliveryChecklistResult
  notes: string | null
}

const CATEGORY_LABELS: Record<DeliveryChecklistCategory, string> = {
  PRE_ENTREGA: 'Pre-entrega',
  EXPLICACION: 'Explicación al cliente',
  FIRMA_SALIDA: 'Firma y salida',
}

const RESULT_OPTIONS: { value: DeliveryChecklistResult; label: string; color: string }[] = [
  { value: 'PENDIENTE', label: 'Pendiente', color: 'text-gray-500' },
  { value: 'OK', label: 'OK', color: 'text-green-600' },
  { value: 'INCIDENCIA', label: 'Incidencia', color: 'text-red-600' },
  { value: 'NO_APLICA', label: 'N/A', color: 'text-gray-400' },
]

const RESULT_BADGE: Record<DeliveryChecklistResult, string> = {
  PENDIENTE: 'bg-gray-100 text-gray-600',
  OK: 'bg-green-100 text-green-700',
  INCIDENCIA: 'bg-red-100 text-red-700',
  NO_APLICA: 'bg-gray-50 text-gray-400',
}

function ChecklistRow({ item, disabled }: { item: ChecklistItem; disabled: boolean }) {
  const [, startTransition] = useTransition()

  function handleChange(result: DeliveryChecklistResult) {
    startTransition(async () => {
      await updateDeliveryChecklistItem(item.id, { result })
    })
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-cn-ink-700">{item.item}</span>
      {disabled ? (
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${RESULT_BADGE[item.result]}`}
        >
          {RESULT_OPTIONS.find((o) => o.value === item.result)?.label}
        </span>
      ) : (
        <select
          value={item.result}
          onChange={(e) => handleChange(e.target.value as DeliveryChecklistResult)}
          className="h-8 rounded-lg border border-cn-line bg-white px-2 text-xs focus:outline-none"
        >
          {RESULT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

export function ChecklistSection({
  items,
  disabled,
}: {
  items: ChecklistItem[]
  disabled: boolean
}) {
  const grouped = Object.entries(CATEGORY_LABELS) as [DeliveryChecklistCategory, string][]

  return (
    <div className="space-y-6">
      {grouped.map(([cat, label]) => {
        const catItems = items.filter((i) => i.category === cat)
        const doneCount = catItems.filter((i) => i.result !== 'PENDIENTE').length
        return (
          <div key={cat} className="overflow-hidden rounded-xl border border-cn-line">
            <div className="flex items-center justify-between border-b border-cn-line bg-cn-cream-50 px-4 py-2.5">
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-cn-ink-400 text-xs">
                {doneCount}/{catItems.length}
              </span>
            </div>
            <div className="divide-y divide-cn-line px-4">
              {catItems.map((item) => (
                <ChecklistRow key={item.id} item={item} disabled={disabled} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
