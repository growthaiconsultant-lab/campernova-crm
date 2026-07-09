import { cn } from '@/lib/utils'

/**
 * Card base del rediseño (ESPEC §4): fondo --card, borde --line, radio 14px,
 * en reposo sin sombra. `pad` controla el padding interno estándar.
 */
export function Card({
  className,
  pad = true,
  children,
}: {
  className?: string
  pad?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-[14px] border border-line bg-card', pad && 'p-4', className)}>
      {children}
    </div>
  )
}

/** Cabecera de card: título 15/700 + acción opcional a la derecha. */
export function CardHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h3 className="font-hanken text-[15px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
      {action}
    </div>
  )
}

/** Eyebrow de sección en JetBrains Mono UPPERCASE (ESPEC §1). */
export function Eyebrow({
  className,
  children,
  tone = 'brand',
}: {
  className?: string
  children: React.ReactNode
  tone?: 'brand' | 'ink3'
}) {
  return (
    <span
      className={cn(
        'font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.12em]',
        tone === 'brand' ? 'text-brand2' : 'text-ink3',
        className
      )}
    >
      {children}
    </span>
  )
}
