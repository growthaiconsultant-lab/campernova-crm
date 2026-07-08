/**
 * Bloque F2 KPIs — lista de barras horizontales (spec §4.4/4.5): comparativa
 * entre categorías. Presentacional (RSC). Color configurable.
 */
export type BarItem = { label: string; count: number }

export function BarList({
  items,
  color = 'var(--sidebar-primary)',
  emptyText = 'Sin datos.',
}: {
  items: BarItem[]
  color?: string
  emptyText?: string
}) {
  if (items.length === 0)
    return <p className="py-4 text-center text-[13px] text-muted-foreground">{emptyText}</p>
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <div className="w-36 shrink-0 truncate text-right text-[12px] text-muted-foreground">
            {it.label}
          </div>
          <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded"
              style={{
                width: `${Math.max(4, Math.round((it.count / max) * 100))}%`,
                background: color,
              }}
            />
          </div>
          <span className="w-8 shrink-0 text-[12px] font-medium text-foreground">{it.count}</span>
        </div>
      ))}
    </div>
  )
}
