import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { InfoTooltip } from '@/components/info-tooltip'
import { SEMAPHORE_HEX, type Semaphore } from '@/lib/kpi/thresholds'

type Props = {
  label: string
  value: string
  /** Variación vs periodo anterior en %, positivo = subida. */
  deltaPct?: number | null
  /** Si una subida es buena (ventas) o mala (leads sin acción). Default: true. */
  higherIsBetter?: boolean
  semaphore?: Semaphore
  tooltip?: string
  /** Línea secundaria (objetivo, desglose corto). */
  sub?: string
  /** Drill-down: enlace a la lista de entidades. */
  href?: string
}

/**
 * Bloque F1 KPIs — KPI Card reutilizable (spec §4.1): valor + variación vs
 * periodo anterior + semáforo + tooltip + drill-down. Presentacional (RSC).
 */
export function KpiCard({
  label,
  value,
  deltaPct,
  higherIsBetter = true,
  semaphore,
  tooltip,
  sub,
  href,
}: Props) {
  const dotColor = semaphore ? SEMAPHORE_HEX[semaphore] : undefined
  const deltaGood =
    deltaPct == null || deltaPct === 0 ? null : higherIsBetter ? deltaPct > 0 : deltaPct < 0
  const DeltaIcon =
    deltaPct == null || deltaPct === 0 ? Minus : deltaPct > 0 ? ArrowUpRight : ArrowDownRight

  const inner = (
    <div className="h-full rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30">
      <div className="mb-1 flex items-center gap-1.5">
        {dotColor && (
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor }} />
        )}
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        {tooltip && <InfoTooltip text={tooltip} side="bottom" />}
      </div>
      <p className="text-[22px] font-bold tracking-[-0.02em] text-foreground">{value}</p>
      <div className="mt-0.5 flex items-center gap-2">
        {deltaPct != null && (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
              deltaGood == null
                ? 'text-muted-foreground'
                : deltaGood
                  ? 'text-green-600'
                  : 'text-red-600'
            }`}
          >
            <DeltaIcon className="h-3 w-3" />
            {Math.abs(deltaPct)}%
          </span>
        )}
        {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  )

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  )
}
