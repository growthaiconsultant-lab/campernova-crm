'use client'

import { useState, type ReactNode } from 'react'

const filters = [
  ['apto', 'Encajan', 'Ningún vehículo cumple todos los imprescindibles confirmados.'],
  [
    'pendiente',
    'Falta comprobar',
    'Ningún vehículo tiene imprescindibles pendientes de comprobar.',
  ],
  ['descartado', 'Fuera de criterios', 'Ningún vehículo incumple los imprescindibles registrados.'],
] as const
export type FitState = (typeof filters)[number][0]

export function BuyerStockFilter({
  groups,
}: {
  groups: Record<FitState, { count: number; list: ReactNode }>
}) {
  const [active, setActive] = useState<FitState>('apto')
  const [, label, empty] = filters.find(([key]) => key === active)!
  return (
    <>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por encaje">
        {filters.map(([key, name]) => (
          <button
            key={key}
            type="button"
            aria-pressed={active === key}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${active === key ? 'border-sidebar-primary bg-sidebar-primary text-white' : 'border-border bg-card hover:bg-muted'}`}
            onClick={() => setActive(key)}
          >
            {name}
            <span className="bg-current/10 rounded px-1.5 tabular-nums">{groups[key].count}</span>
          </button>
        ))}
      </div>
      <p role="status" className="sr-only">
        {label} · {groups[active].count} vehículos
      </p>
      {groups[active].count ? (
        groups[active].list
      ) : (
        <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </>
  )
}
