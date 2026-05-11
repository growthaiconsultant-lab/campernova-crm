import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export type KpiCardProps = {
  label: string
  value: string | number
  hint?: string
  trend?: 'up' | 'down' | 'flat'
  trendLabel?: string
  highlight?: 'green' | 'red' | 'amber' | 'blue' | 'default'
}

export function KpiCard({
  label,
  value,
  hint,
  trend,
  trendLabel,
  highlight = 'default',
}: KpiCardProps) {
  const valueColor =
    highlight === 'green'
      ? 'text-green-600'
      : highlight === 'red'
        ? 'text-red-600'
        : highlight === 'amber'
          ? 'text-amber-600'
          : highlight === 'blue'
            ? 'text-blue-600'
            : ''

  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-3xl font-bold ${valueColor}`}>{value}</p>
        {trend && trendLabel && (
          <div className={`mt-1 flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            <span>{trendLabel}</span>
          </div>
        )}
        {hint && !trendLabel && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
