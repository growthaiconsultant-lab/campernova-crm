import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PillTone } from './pill'

/**
 * KPI card del rediseño (ESPEC §4): --card, borde --line, radio 14px, padding
 * 15–16px. Label 12/600 ink2; cifra 28/700 −0.03em; nota 11.5/500 ink3.
 * Si `tone` está presente, barra vertical de 3px de color de estado a la izq.
 * Opcional: variación vs periodo anterior (delta) con flecha + color.
 */
const BAR: Record<PillTone, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  brand: 'bg-brand',
  neutral: 'bg-ink3',
}

const DELTA_COLOR: Record<'up' | 'down' | 'flat', string> = {
  up: 'text-good',
  down: 'text-bad',
  flat: 'text-ink3',
}

export interface KpiCardProps {
  label: string
  value: React.ReactNode
  /** Nota bajo la cifra (ej. "3 vencen esta semana"). */
  note?: React.ReactNode
  /** Semáforo → barra lateral de estado. */
  tone?: PillTone
  /** Variación vs periodo anterior en %. Signo decide flecha/color. */
  deltaPct?: number
  /** Icono opcional a la derecha del label. */
  icon?: React.ReactNode
  /** Drill-down: convierte la card en enlace. */
  href?: string
  className?: string
}

export function KpiCard({
  label,
  value,
  note,
  tone,
  deltaPct,
  icon,
  href,
  className,
}: KpiCardProps) {
  const dir: 'up' | 'down' | 'flat' =
    deltaPct === undefined || deltaPct === 0 ? 'flat' : deltaPct > 0 ? 'up' : 'down'

  const inner = (
    <div
      className={cn(
        'relative h-full rounded-[14px] border border-line bg-card p-4 transition-colors',
        href && 'hover:border-ink3/40',
        className
      )}
    >
      {tone && (
        <span
          className={cn('absolute bottom-4 left-0 top-4 w-[3px] rounded-r-[3px]', BAR[tone])}
          aria-hidden
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="font-hanken text-[12px] font-semibold text-ink2">{label}</span>
        {icon}
      </div>
      <div className="mt-1.5 flex items-end gap-2">
        <span className="font-hanken text-[28px] font-bold leading-none tracking-[-0.03em] text-ink">
          {value}
        </span>
        {deltaPct !== undefined && (
          <span
            className={cn(
              'mb-0.5 inline-flex items-center gap-0.5 font-mono text-[11.5px] font-semibold',
              DELTA_COLOR[dir]
            )}
          >
            {dir === 'up' && <ArrowUpRight size={13} strokeWidth={2.4} />}
            {dir === 'down' && <ArrowDownRight size={13} strokeWidth={2.4} />}
            {deltaPct > 0 ? '+' : ''}
            {deltaPct}%
          </span>
        )}
      </div>
      {note && <div className="mt-1.5 font-hanken text-[11.5px] font-medium text-ink3">{note}</div>}
    </div>
  )

  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  )
}
