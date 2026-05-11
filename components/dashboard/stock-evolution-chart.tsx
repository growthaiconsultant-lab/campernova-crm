'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { StockSnapshot } from '@/lib/dashboard/metrics'

type Props = {
  data: StockSnapshot[]
}

const EUR = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function formatMonth(month: string) {
  const [year, m] = month.split('-')
  const date = new Date(Number(year), Number(m) - 1, 1)
  return date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
}

export function StockEvolutionChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin datos de stock histórico.
      </p>
    )
  }

  const chartData = data.map((d) => ({
    ...d,
    monthLabel: formatMonth(d.month),
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="value"
          orientation="left"
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === 'Valor stock') return [EUR.format(value), name]
            return [value, name]
          }}
          labelStyle={{ fontWeight: 600 }}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid hsl(var(--border))',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar
          yAxisId="value"
          dataKey="stockValue"
          name="Valor stock"
          fill="hsl(177, 31%, 23%)"
          opacity={0.8}
          radius={[3, 3, 0, 0]}
        />
        <Line
          yAxisId="count"
          dataKey="vehicleCount"
          name="Vehículos"
          stroke="hsl(24, 78%, 45%)"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
