import type { FunnelComparisonResult } from '@/lib/dashboard/metrics'

type Props = {
  data: FunnelComparisonResult
}

type ChannelProps = {
  label: string
  data: FunnelComparisonResult['pro']
  colorClass: string
  bgClass: string
}

function ChannelFunnel({ label, data, colorClass, bgClass }: ChannelProps) {
  const stages = [
    { label: 'Leads recibidos', value: data.total, pct: 100 },
    {
      label: 'Llegaron a publicado',
      value: data.published,
      pct: data.total > 0 ? (data.published / data.total) * 100 : 0,
    },
    {
      label: 'Vendidos',
      value: data.sold,
      pct: data.total > 0 ? (data.sold / data.total) * 100 : 0,
    },
  ]

  return (
    <div className="min-w-0 flex-1">
      <h4 className={`mb-3 text-xs font-semibold uppercase tracking-wide ${colorClass}`}>
        Canal {label}
      </h4>
      {data.total === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos.</p>
      ) : (
        <div className="space-y-2.5">
          {stages.map((s) => (
            <div key={s.label}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm">{s.label}</span>
                <span className="text-sm font-semibold">{s.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${bgClass}`}
                  style={{ width: `${Math.max(s.pct, 0)}%` }}
                />
              </div>
              {s.pct < 100 && (
                <p className="mt-0.5 text-right text-xs text-muted-foreground">
                  {s.pct.toFixed(0)}%
                </p>
              )}
            </div>
          ))}
          {data.soldRate !== null && (
            <p className="border-t pt-2 text-xs text-muted-foreground">
              Pub → venta: <strong className="text-foreground">{data.soldRate.toFixed(1)}%</strong>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function FunnelComparison({ data }: Props) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <ChannelFunnel
        label="Pro"
        data={data.pro}
        colorClass="text-teal-700 dark:text-teal-400"
        bgClass="bg-teal-600"
      />
      <div className="hidden w-px bg-border sm:block" />
      <ChannelFunnel
        label="CN"
        data={data.cn}
        colorClass="text-amber-700 dark:text-amber-400"
        bgClass="bg-amber-500"
      />
    </div>
  )
}
