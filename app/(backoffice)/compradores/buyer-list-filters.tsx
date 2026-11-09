'use client'

import { useId, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BUYER_SOURCE_OPTIONS } from '@/lib/buyer-source'
import { TEMPERATURE_OPTIONS } from '@/lib/lead-temperature'
import { BUYER_LEAD_STATUS_LABELS } from '@/lib/state-machine'

const advancedFilters = ['vehicleType', 'source', 'agentId', 'budgetMin', 'seatsMin', 'temp']
const statusOptions = Object.entries(BUYER_LEAD_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}))
const selectClass =
  'h-9 max-w-full rounded-lg border border-line bg-card px-2.5 text-[13px] font-medium text-ink2 focus-visible:ring-2 focus-visible:ring-ring'

export function BuyerListFilters({ agents }: { agents: { id: string; name: string }[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const activeCount = advancedFilters.filter((key) => params.get(key)).length
  const [expanded, setExpanded] = useState(activeCount > 0)
  const filtersId = useId()
  function navigate(next: URLSearchParams) {
    next.delete('page')
    router.push(`/compradores${next.size ? '?' + next.toString() : ''}`, { scroll: false })
  }
  function change(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    navigate(next)
  }
  function selectFilter(
    key: string,
    label: string,
    options: readonly { value: string; label: string }[]
  ) {
    return (
      <label className="grid min-w-0 gap-1 text-xs font-medium text-ink2">
        {label}
        <select
          aria-label={label}
          value={params.get(key) ?? ''}
          onChange={(e) => change(key, e.target.value)}
          className={selectClass}
        >
          <option value="">Cualquiera</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    )
  }
  const hasFilters =
    activeCount > 0 || ['q', 'status', 'dateFrom', 'dateTo'].some((key) => params.get(key))
  return (
    <div className="border-t border-line2 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex h-10 w-full items-center gap-2 rounded-lg border border-line bg-canvas px-3 focus-within:border-brand sm:w-auto sm:min-w-52 sm:flex-1"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            change('q', String(new FormData(e.currentTarget).get('q') ?? '').trim())
          }}
        >
          <button
            type="submit"
            aria-label="Buscar compradores"
            className="rounded text-ink2 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search size={16} />
          </button>
          <input
            key={params.get('q') ?? ''}
            name="q"
            defaultValue={params.get('q') ?? ''}
            aria-label="Buscar por nombre, email, teléfono, tipo o zona"
            placeholder="Buscar por nombre, email, teléfono, tipo o zona…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
          />
        </form>
        <select
          aria-label="Filtrar por estado"
          className={selectClass}
          value={params.get('status') ?? ''}
          onChange={(e) => change('status', e.target.value)}
        >
          <option value="">Todos los estados</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={filtersId}
          onClick={() => setExpanded(!expanded)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[13px] font-semibold text-ink2 hover:bg-canvas focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal size={14} /> Filtros
          {activeCount > 0 && (
            <span className="rounded bg-brand-tint px-1.5 text-brand">{activeCount}</span>
          )}
        </button>
        <select
          aria-label="Ordenar compradores"
          value={params.get('sort') ?? 'createdAt'}
          className={selectClass}
          onChange={(e) => change('sort', e.target.value)}
        >
          <option value="createdAt">Por entrada</option>
          <option value="updatedAt">Por actualización</option>
          <option value="maxBudget">Por presupuesto</option>
        </select>
        {hasFilters && (
          <button
            type="button"
            className="rounded px-2 text-xs font-semibold text-brand focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              const next = new URLSearchParams(params.toString())
              for (const key of [...advancedFilters, 'q', 'status', 'dateFrom', 'dateTo'])
                next.delete(key)
              navigate(next)
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>
      <div id={filtersId} hidden={!expanded}>
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-canvas p-3 sm:grid-cols-3 xl:grid-cols-6">
          {selectFilter('temp', 'Temperatura', TEMPERATURE_OPTIONS)}
          {selectFilter('agentId', 'Responsable', [
            { value: '__none__', label: 'Sin asignar' },
            ...agents.map((a) => ({ value: a.id, label: a.name })),
          ])}
          {selectFilter('source', 'Origen', [
            ...BUYER_SOURCE_OPTIONS,
            { value: '__none__', label: 'Sin especificar / Backoffice' },
          ])}
          {selectFilter('vehicleType', 'Tipo de vehículo', [
            { value: 'CAMPER', label: 'Camper' },
            { value: 'AUTOCARAVANA', label: 'Autocaravana' },
          ])}
          {selectFilter(
            'budgetMin',
            'Presupuesto mínimo',
            [10000, 20000, 30000, 40000, 50000, 60000, 80000].map((n) => ({
              value: String(n),
              label: n.toLocaleString('es-ES') + ' €',
            }))
          )}
          {selectFilter(
            'seatsMin',
            'Plazas mínimas',
            [2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: n + ' plazas' }))
          )}
        </div>
      </div>
    </div>
  )
}
