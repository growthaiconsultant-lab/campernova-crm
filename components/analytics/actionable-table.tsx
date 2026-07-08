import Link from 'next/link'
import { SEMAPHORE_HEX, type Semaphore } from '@/lib/kpi/thresholds'

export type TableColumn = {
  key: string
  label: string
  align?: 'left' | 'right'
}

export type TableRow = {
  id: string
  href?: string // drill-down a la ficha
  semaphore?: Semaphore
  cells: Record<string, string>
}

/**
 * Bloque F1 KPIs — tabla accionable (spec §4.7): lista con drill-down a la ficha
 * de cada entidad + estado semáforo. Presentacional (RSC). Empty state útil.
 */
export function ActionableTable({
  columns,
  rows,
  emptyText = 'Nada que mostrar. Todo al día.',
}: {
  columns: TableColumn[]
  rows: TableRow[]
  emptyText?: string
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[13px] text-muted-foreground">{emptyText}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground ${
                  c.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {c.label}
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
              {columns.map((c, i) => (
                <td
                  key={c.key}
                  className={`px-2 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'} ${
                    i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {i === 0 && r.semaphore && (
                    <span
                      className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                      style={{ background: SEMAPHORE_HEX[r.semaphore] }}
                    />
                  )}
                  {r.cells[c.key] ?? '—'}
                </td>
              ))}
              <td className="px-2 py-2 text-right">
                {r.href && (
                  <Link
                    href={r.href}
                    className="text-[12px] font-medium text-sidebar-primary hover:underline"
                  >
                    Ver →
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
