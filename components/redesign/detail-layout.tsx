import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Layout de ficha (drill-in) del rediseño (ESPEC §4): cabecera con breadcrumb
 * (ChevronLeft + módulo + / entidad) y acciones a la derecha; cuerpo en grid
 * `1fr 320px` (izq = contenido, der = próxima acción + metadatos). En móvil,
 * una sola columna (la aside baja al final). Se monta dentro del shell.
 */
export function DetailLayout({
  module,
  moduleHref,
  entity,
  actions,
  children,
  aside,
}: {
  /** Etiqueta del módulo en el breadcrumb (ej. "Vendedores"). */
  module: string
  moduleHref: string
  /** Entidad actual (ej. nombre del lead / matrícula). */
  entity: React.ReactNode
  actions?: React.ReactNode
  /** Columna izquierda: cards de contenido. */
  children: React.ReactNode
  /** Columna derecha (320px): próxima acción, metadatos, "al completar". */
  aside?: React.ReactNode
}) {
  return (
    <div className="-m-6 flex min-h-full flex-col bg-canvas">
      {/* Breadcrumb + acciones */}
      <header className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-card px-4 lg:px-[22px]">
        <Link
          href={moduleHref}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink2 transition-colors hover:text-ink"
        >
          <ChevronLeft size={15} strokeWidth={2.2} />
          {module}
        </Link>
        <span className="font-mono text-[11px] text-ink3">/</span>
        <span className="truncate font-hanken text-[15px] font-bold tracking-[-0.01em] text-ink">
          {entity}
        </span>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </header>

      {/* Cuerpo */}
      <div
        className={cn(
          'grid flex-1 items-start gap-[18px] p-4 lg:p-[22px]',
          aside ? 'grid-cols-1 lg:grid-cols-[1fr_320px]' : 'grid-cols-1'
        )}
      >
        <div className="flex min-w-0 flex-col gap-[18px]">{children}</div>
        {aside && <aside className="flex flex-col gap-[16px]">{aside}</aside>}
      </div>
    </div>
  )
}
