'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { CalendarSource } from '@/lib/calendar/types'

const SOURCE_OPTIONS: { value: CalendarSource; label: string }[] = [
  { value: 'delivery', label: 'Entregas' },
  { value: 'workorder', label: 'Taller' },
  { value: 'next_action', label: 'Próximas acciones' },
  { value: 'followup', label: 'Postventa' },
]

type Agent = { id: string; name: string }

export function CalendarFilters({ agents }: { agents: Agent[] }) {
  const router = useRouter()
  const params = useSearchParams()

  const push = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(params.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      router.push(`/calendario?${next.toString()}`)
    },
    [params, router]
  )

  const currentSources = (params.get('source')?.split(',').filter(Boolean) ??
    []) as CalendarSource[]
  const currentAssignee = params.get('assignee') ?? ''

  const toggleSource = (s: CalendarSource) => {
    const set = new Set(currentSources)
    if (set.has(s)) set.delete(s)
    else set.add(s)
    push({ source: Array.from(set).join(',') })
  }

  const chipBase =
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium cursor-pointer select-none whitespace-nowrap transition-colors'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SOURCE_OPTIONS.map((o) => {
        const active = currentSources.length === 0 || currentSources.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggleSource(o.value)}
            className={`${chipBase} ${
              currentSources.includes(o.value)
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card text-muted-foreground hover:border-foreground/40'
            }`}
            style={{ opacity: currentSources.length === 0 ? 0.85 : active ? 1 : 0.55 }}
          >
            {o.label}
          </button>
        )
      })}

      <label className="relative cursor-pointer">
        <span className={`${chipBase} border-border bg-card text-muted-foreground`}>
          {currentAssignee
            ? (agents.find((a) => a.id === currentAssignee)?.name ?? 'Responsable')
            : 'Responsable'}
          <svg
            viewBox="0 0 24 24"
            className="h-3 w-3 opacity-60"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={currentAssignee}
          onChange={(e) => push({ assignee: e.target.value })}
        >
          <option value="">Todos</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      {(currentSources.length > 0 || currentAssignee) && (
        <button
          type="button"
          onClick={() => router.push('/calendario')}
          className="px-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Limpiar
        </button>
      )}
    </div>
  )
}
