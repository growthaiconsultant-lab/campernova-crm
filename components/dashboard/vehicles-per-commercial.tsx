'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { VehiclesPerCommercialResult } from '@/lib/dashboard/metrics'

type Props = {
  data: VehiclesPerCommercialResult[]
}

export function VehiclesPerCommercial({ data }: Props) {
  if (data.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">Sin datos de agentes.</p>
  }

  const chartData = data.map((d) => ({
    name: d.agentName.split(' ')[0],
    activos: d.active,
    publicados: d.published,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid hsl(var(--border))',
            fontSize: 12,
          }}
        />
        <Bar dataKey="activos" name="En stock" radius={[3, 3, 0, 0]} fill="hsl(177, 31%, 23%)">
          {chartData.map((_, i) => (
            <Cell key={i} fillOpacity={0.75} />
          ))}
        </Bar>
        <Bar dataKey="publicados" name="Publicados" radius={[3, 3, 0, 0]} fill="hsl(24, 78%, 45%)">
          {chartData.map((_, i) => (
            <Cell key={i} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
