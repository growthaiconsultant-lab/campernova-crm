'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { RANGE_OPTIONS, DEFAULT_RANGE, isValidRangeKey } from '@/lib/kpi/range'
import { cn } from '@/lib/utils'

/**
 * Filtro global de rango de fechas de Analytics (spec §3): chips de rangos
 * rápidos escritos en `?range=` (se comparte entre dashboards vía las tabs,
 * que preservan el parámetro). Afecta a los KPIs de FLUJO; los de estado son
 * snapshot y lo indican en su sección.
 */
export function RangeFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const raw = searchParams.get('range')
  const active = isValidRangeKey(raw) ? raw : DEFAULT_RANGE

  function setRange(key: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (key === DEFAULT_RANGE) sp.delete('range')
    else sp.set('range', key)
    const qs = sp.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ink3">
        Periodo
      </span>
      {RANGE_OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => setRange(o.key)}
          className={cn(
            'rounded-[8px] border px-2.5 py-1 font-hanken text-[12px] font-semibold transition-colors',
            active === o.key
              ? 'border-brand bg-brand-tint text-brand'
              : 'border-line bg-card text-ink2 hover:bg-canvas'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
