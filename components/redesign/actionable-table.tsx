import Link from 'next/link'
import { cn } from '@/lib/utils'
import { EmptyState } from './states'

/**
 * Tabla accionable del rediseño (ESPEC §4): cabecera mono 10.5/600 ink3
 * UPPERCASE con border-top/bottom line2; filas separadas por line2; celda
 * principal 13/600 ink, secundaria 12.5/500 ink2; importes en JetBrains Mono;
 * última columna = CTA. Hover de fila sutil. Genérica y tipada por fila.
 */
export interface Column<T> {
  key: string
  header: React.ReactNode
  /** Contenido de la celda. */
  cell: (row: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
  /** Cifras/códigos → JetBrains Mono. */
  mono?: boolean
  className?: string
  headerClassName?: string
}

export interface ActionableTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Enlace de fila (drill-down) — toda la fila navega a la ficha. */
  rowHref?: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: React.ReactNode
  className?: string
  /** Móvil (ESPEC §6): si se pasa, en <lg la tabla se convierte en una lista
   *  de tarjetas con los campos críticos; la tabla solo se muestra en ≥lg. */
  mobileCard?: (row: T) => React.ReactNode
}

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const

export function ActionableTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  empty,
  className,
  mobileCard,
}: ActionableTableProps<T>) {
  if (rows.length === 0) {
    return (
      empty ?? (
        <EmptyState
          title="Nada por aquí todavía"
          description="Cuando haya registros, aparecerán en esta tabla."
        />
      )
    )
  }

  // Móvil: lista de tarjetas con los campos críticos (la tabla queda ≥lg)
  const mobileList = mobileCard && (
    <div className="flex flex-col gap-2.5 p-3 lg:hidden">
      {rows.map((row) => {
        const href = rowHref?.(row)
        const card = (
          <div className="rounded-[11px] border border-line bg-card p-3 shadow-[0_1px_2px_rgba(20,25,34,0.04)]">
            {mobileCard(row)}
          </div>
        )
        return href ? (
          <Link key={rowKey(row)} href={href} className="block">
            {card}
          </Link>
        ) : (
          <div key={rowKey(row)}>{card}</div>
        )
      })}
    </div>
  )

  return (
    <>
      {mobileList}
      <div className={cn('overflow-x-auto', mobileCard && 'hidden lg:block', className)}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-line2">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'whitespace-nowrap px-[18px] py-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink3',
                    ALIGN[c.align ?? 'left'],
                    c.headerClassName
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = rowHref?.(row)
              const interactive = Boolean(href || onRowClick)
              return (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'group border-b border-line2 transition-colors last:border-0',
                    interactive && 'cursor-pointer hover:bg-line2',
                    href && 'relative'
                  )}
                >
                  {columns.map((c, ci) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-[18px] py-3 align-middle font-hanken text-[13px] font-semibold text-ink',
                        c.mono && 'font-mono',
                        ALIGN[c.align ?? 'left'],
                        // La columna CTA queda por encima del overlay de fila.
                        c.key === '__cta' && 'relative z-[1]',
                        c.className
                      )}
                    >
                      {/* Drill-down: la 1ª celda lleva el enlace estirado que hace
                        clicable toda la fila (stretched-link) sin anidar <a> en <tr>. */}
                      {href && ci === 0 ? (
                        <Link
                          href={href}
                          className="after:absolute after:inset-0 after:content-['']"
                        >
                          {c.cell(row)}
                        </Link>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** Texto secundario dentro de una celda (12.5/500 ink2). */
export function CellSub({ children }: { children: React.ReactNode }) {
  return <div className="mt-0.5 font-hanken text-[12.5px] font-medium text-ink2">{children}</div>
}
