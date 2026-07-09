import { cn } from '@/lib/utils'

/**
 * Status pill / badge del rediseño (ESPEC §4): texto 10.5–11px/600, padding
 * 3px 8px, radio 6px, color de texto = color de estado, fondo = tint del estado.
 * El color codifica significado (semáforo), nunca decora.
 */
export type PillTone = 'good' | 'warn' | 'bad' | 'info' | 'brand' | 'neutral'

const TONE: Record<PillTone, string> = {
  good: 'text-good bg-good-tint',
  warn: 'text-warn bg-warn-tint',
  bad: 'text-bad bg-bad-tint',
  info: 'text-info bg-info-tint',
  brand: 'text-brand bg-brand-tint',
  neutral: 'text-ink2 bg-track',
}

export function Pill({
  tone = 'neutral',
  className,
  children,
  dot = false,
}: {
  tone?: PillTone
  className?: string
  children: React.ReactNode
  /** Punto de color a la izquierda (usado en selectores de estado). */
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] font-hanken text-[10.5px] font-semibold leading-tight',
        TONE[tone],
        className
      )}
    >
      {dot && <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

/** Convierte un color hex de estado (lib/state-machine, lib/captacion) a estilos
 *  inline tint+texto, para enums cuyo color vive como hex y no como tono. */
export function HexPill({
  hex,
  className,
  children,
}: {
  hex: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] font-hanken text-[10.5px] font-semibold leading-tight',
        className
      )}
      style={{ color: hex, backgroundColor: `${hex}1f` }}
    >
      {children}
    </span>
  )
}
