'use client'

import { useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ViewCounts = {
  todos: number
  misLeads: number
  sinAsignar: number
  necesitanAccion: number
  estaSemana: number
}

type Agent = { id: string; name: string }

type Props = {
  agents: Agent[]
  currentView: string
  viewCounts: ViewCounts
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VIEWS = [
  { key: 'todos', label: 'Todos', count: (c: ViewCounts) => c.todos },
  { key: 'mis-leads', label: 'Mis leads', count: (c: ViewCounts) => c.misLeads },
  { key: 'sin-asignar', label: 'Sin asignar', count: (c: ViewCounts) => c.sinAsignar },
  {
    key: 'necesitan-accion',
    label: 'Necesitan acción',
    count: (c: ViewCounts) => c.necesitanAccion,
  },
  { key: 'esta-semana', label: 'Esta semana', count: (c: ViewCounts) => c.estaSemana },
] as const

const STATUS_OPTIONS = [
  { value: 'NUEVO', label: 'Nuevo' },
  { value: 'CONTACTADO', label: 'Contactado' },
  { value: 'CUALIFICADO', label: 'Cualificado' },
  { value: 'EN_NEGOCIACION', label: 'En negociación' },
  { value: 'CERRADO', label: 'Cerrado' },
  { value: 'DESCARTADO', label: 'Descartado' },
]

const CANAL_OPTIONS = [
  { value: 'CN', label: 'CN (backoffice)' },
  { value: 'PRO', label: 'PRO (formulario web)' },
]

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Fecha entrada' },
  { value: 'updatedAt', label: 'Última actividad' },
  { value: 'desiredPrice', label: 'Precio deseado' },
]

const MONO = {
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LeadsFilters({ agents, currentView, viewCounts }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const push = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(params.toString())
      Object.entries(updates).forEach(([key, val]) => {
        if (val) next.set(key, val)
        else next.delete(key)
      })
      next.delete('page')
      router.push(`/vendedores?${next.toString()}`)
    },
    [params, router]
  )

  const activeStatus = params.get('status') ?? ''
  const activeAgent = params.get('agentId') ?? ''
  const activeCanal = params.get('canal') ?? ''
  const activeSort = params.get('sort') ?? 'createdAt'
  const activeQ = params.get('q') ?? ''
  const hasFilters = !!(activeStatus || activeAgent || activeCanal || activeQ)

  function viewUrl(viewKey: string): string {
    const sp = new URLSearchParams()
    if (viewKey !== 'todos') sp.set('view', viewKey)
    // Preserve search filters when switching views
    if (activeQ) sp.set('q', activeQ)
    if (activeStatus) sp.set('status', activeStatus)
    if (activeAgent) sp.set('agentId', activeAgent)
    if (activeCanal) sp.set('canal', activeCanal)
    if (activeSort && activeSort !== 'createdAt') sp.set('sort', activeSort)
    const dir = params.get('dir')
    if (dir && dir !== 'desc') sp.set('dir', dir)
    const qs = sp.toString()
    return `/vendedores${qs ? `?${qs}` : ''}`
  }

  function clearFilters() {
    const view = params.get('view')
    router.push(view && view !== 'todos' ? `/vendedores?view=${view}` : '/vendedores')
    if (searchInputRef.current) searchInputRef.current.value = ''
  }

  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #e6dfd0' }}>
      {/* ── Saved views tabs ── */}
      <div className="flex items-stretch gap-0 overflow-x-auto px-6">
        {VIEWS.map((view) => {
          const isActive = currentView === view.key
          const count = view.count(viewCounts)
          return (
            <a
              key={view.key}
              href={viewUrl(view.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm transition-colors',
                isActive
                  ? 'border-[#0a0a0a] font-semibold text-[#0a0a0a]'
                  : 'border-transparent text-[#6b645c] hover:text-[#0a0a0a]'
              )}
              style={{ fontSize: '13px' }}
            >
              {view.label}
              {count > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 leading-none"
                  style={{
                    ...MONO,
                    fontSize: '10px',
                    background: isActive ? 'rgba(10,10,10,0.08)' : '#f5f0e6',
                    color: isActive ? '#0a0a0a' : '#6b645c',
                  }}
                >
                  {count}
                </span>
              )}
            </a>
          )
        })}

        {/* Guardar vista (decorative) */}
        <div className="ml-auto flex shrink-0 items-center">
          <button
            className="text-xs transition-colors hover:text-[#0a0a0a]"
            style={{ ...MONO, fontSize: '10.5px', color: '#584738' }}
          >
            Guardar vista
          </button>
        </div>
      </div>

      {/* ── Chip filter bar ── */}
      <div className="flex items-center gap-2 px-6 py-2.5">
        {/* Search */}
        <div
          className="flex flex-1 items-center gap-2 rounded-md px-3 py-1.5"
          style={{ background: '#f5f0e6', border: '1px solid #e6dfd0' }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: '#6b645c' }} />
          <input
            ref={searchInputRef}
            type="text"
            defaultValue={activeQ}
            placeholder="Buscar nombre, email, teléfono… (↵ para buscar)"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ ...MONO, fontSize: '12px', color: '#0a0a0a' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                push({ q: (e.target as HTMLInputElement).value.trim() })
              }
            }}
            onChange={(e) => {
              if (!e.target.value) push({ q: '' })
            }}
          />
        </div>

        {/* Estado chip */}
        <ChipSelect
          label="Estado"
          value={activeStatus}
          options={STATUS_OPTIONS}
          onSelect={(v) => push({ status: v })}
        />

        {/* Agente chip */}
        <ChipSelect
          label="Agente"
          value={activeAgent}
          options={[
            { value: '__none__', label: 'Sin asignar' },
            ...agents.map((a) => ({ value: a.id, label: a.name })),
          ]}
          onSelect={(v) => push({ agentId: v })}
        />

        {/* Canal chip */}
        <ChipSelect
          label="Canal"
          value={activeCanal}
          options={CANAL_OPTIONS}
          onSelect={(v) => push({ canal: v })}
        />

        {/* Spacer + right side */}
        <div className="ml-auto flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors hover:bg-[#f5f0e6]"
              style={{ color: '#6b645c' }}
            >
              <X className="h-3 w-3" />
              Limpiar
            </button>
          )}
          {/* Sort */}
          <ChipSelect
            label={`↕ ${SORT_OPTIONS.find((o) => o.value === activeSort)?.label ?? 'Ordenar'}`}
            value={activeSort}
            options={SORT_OPTIONS}
            onSelect={(v) => push({ sort: v })}
          />
          {/* Direction */}
          <button
            onClick={() => push({ dir: params.get('dir') === 'asc' ? 'desc' : 'asc' })}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[#f5f0e6]"
            style={{
              ...MONO,
              fontSize: '11px',
              color: '#6b645c',
              border: '1px solid #e6dfd0',
            }}
            title="Cambiar dirección"
          >
            {params.get('dir') === 'asc' ? '↑ Antiguo' : '↓ Reciente'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ChipSelect ───────────────────────────────────────────────────────────────

function ChipSelect({
  label,
  value,
  options,
  onSelect,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onSelect: (v: string) => void
}) {
  const isActive = !!value
  const selectedLabel = options.find((o) => o.value === value)?.label

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors"
          style={{
            background: isActive ? '#0a0a0a' : '#f5f0e6',
            color: isActive ? '#fff' : '#2a2622',
            border: `1px solid ${isActive ? '#0a0a0a' : '#e6dfd0'}`,
            fontSize: '12.5px',
          }}
        >
          {isActive && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#b59e7d' }} />
          )}
          <span>{isActive && selectedLabel ? selectedLabel : label}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[176px]">
        {isActive && (
          <DropdownMenuItem
            onClick={() => onSelect('')}
            style={{ color: '#6b645c', fontSize: '12.5px' }}
          >
            Todos (limpiar)
          </DropdownMenuItem>
        )}
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            style={{
              fontSize: '12.5px',
              fontWeight: value === opt.value ? 600 : 400,
              color: value === opt.value ? '#0a0a0a' : '#2a2622',
            }}
          >
            {value === opt.value && <span className="mr-1.5 text-[10px]">✓</span>}
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
