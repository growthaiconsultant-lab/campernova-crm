import Link from 'next/link'
import { Inbox, AlertTriangle, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Estados de datos (ESPEC §5): nunca "No data". El vacío explica qué aparecerá
 * y ofrece un CTA para crear el primer registro; loading = skeletons con
 * --track; error = mensaje + reintentar.
 */
export function EmptyState({
  icon,
  title,
  description,
  cta,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  cta?: { label: string; href?: string; onClick?: () => void }
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-line bg-card px-6 py-12 text-center',
        className
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-track text-ink3">
        {icon ?? <Inbox size={20} strokeWidth={1.9} />}
      </span>
      <div className="max-w-[380px]">
        <h4 className="font-hanken text-[15px] font-bold text-ink">{title}</h4>
        {description && (
          <p className="mt-1 font-hanken text-[13px] leading-[1.5] text-ink2">{description}</p>
        )}
      </div>
      {cta &&
        (cta.href ? (
          <Link
            href={cta.href}
            className="mt-1 inline-flex items-center gap-1.5 rounded-[10px] bg-brand px-[15px] py-[9px] font-hanken text-[12.5px] font-semibold text-white transition-colors hover:bg-brand2"
          >
            <Plus size={15} strokeWidth={2.2} />
            {cta.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            className="mt-1 inline-flex items-center gap-1.5 rounded-[10px] bg-brand px-[15px] py-[9px] font-hanken text-[12.5px] font-semibold text-white transition-colors hover:bg-brand2"
          >
            <Plus size={15} strokeWidth={2.2} />
            {cta.label}
          </button>
        ))}
    </div>
  )
}

/** Bloque skeleton con el track del sistema. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[8px] bg-track', className)} />
}

/** Skeleton de varias líneas para tablas/listas. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  )
}

export function ErrorState({
  title = 'No se pudo cargar',
  description = 'Ha ocurrido un problema al obtener los datos.',
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[14px] border border-line bg-card px-6 py-12 text-center',
        className
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bad-tint text-bad">
        <AlertTriangle size={20} strokeWidth={1.9} />
      </span>
      <div className="max-w-[380px]">
        <h4 className="font-hanken text-[15px] font-bold text-ink">{title}</h4>
        <p className="mt-1 font-hanken text-[13px] leading-[1.5] text-ink2">{description}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-[10px] border border-line bg-card px-[15px] py-[9px] font-hanken text-[12.5px] font-semibold text-ink transition-colors hover:bg-canvas"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}
