import Link from 'next/link'

export type FunnelStage = { label: string; count: number; href?: string }

/**
 * Bloque F1 KPIs — Funnel chart (spec §4.2): volumen por etapa + conversión y
 * caída entre etapas + drill-down por etapa. CSS puro, sin librería (RSC).
 */
export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1)
  const first = stages[0]?.count ?? 0

  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const widthPct = Math.max(3, Math.round((s.count / max) * 100))
        const prev = i > 0 ? stages[i - 1].count : null
        const stepConv = prev && prev > 0 ? Math.round((s.count / prev) * 100) : null
        const totalConv = first > 0 ? Math.round((s.count / first) * 100) : null
        const Row = (
          <div className="group flex items-center gap-3">
            <div className="w-40 shrink-0 text-right text-[12px] text-muted-foreground">
              {s.label}
            </div>
            <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-muted">
              <div
                className="flex h-full items-center rounded-md bg-sidebar-primary px-2 transition-all group-hover:opacity-90"
                style={{ width: `${widthPct}%` }}
              >
                <span className="text-[12px] font-semibold text-white">{s.count}</span>
              </div>
            </div>
            <div className="w-24 shrink-0 text-[11px] text-muted-foreground">
              {stepConv != null && (
                <span className={stepConv < 40 ? 'text-amber-600' : ''}>{stepConv}% ↓</span>
              )}
              {totalConv != null && i === stages.length - 1 && (
                <span className="ml-1 font-medium text-foreground">· {totalConv}% tot.</span>
              )}
            </div>
          </div>
        )
        return s.href ? (
          <Link key={s.label} href={s.href} className="block">
            {Row}
          </Link>
        ) : (
          <div key={s.label}>{Row}</div>
        )
      })}
    </div>
  )
}
