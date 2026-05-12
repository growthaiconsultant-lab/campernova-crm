'use client'

import { useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

// Kept for backward-compat (no longer passed from page.tsx but may be imported elsewhere)
export type ViewCounts = Record<string, never>

type Agent = { id: string; name: string }
type Props = { agents: Agent[] }

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'NUEVO', label: 'Nuevo' },
  { value: 'CONTACTADO', label: 'Contactado' },
  { value: 'CUALIFICADO', label: 'Tasado' },
  { value: 'EN_NEGOCIACION', label: 'En negociación' },
  { value: 'CERRADO', label: 'Cerrado' },
  { value: 'DESCARTADO', label: 'Descartado' },
]

const STATUS_COLORS: Record<string, string> = {
  NUEVO: '#2563eb',
  CONTACTADO: '#7c3aed',
  CUALIFICADO: '#0891b2',
  EN_NEGOCIACION: '#d97706',
  CERRADO: '#1f8a5b',
  DESCARTADO: '#94a3b8',
}

const BRAND_OPTIONS = [
  'Volkswagen',
  'Mercedes',
  'Ford',
  'Hymer',
  'Adria',
  'Dethleffs',
  'Chausson',
  'Pilote',
  'Carado',
  'Knaus',
]

const PRICE_OPTIONS = [10000, 20000, 30000, 40000, 50000, 75000, 100000]

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Entrada ↓' },
  { value: 'updatedAt', label: 'Actualización ↓' },
  { value: 'desiredPrice', label: 'Precio ↓' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function LeadsFilters({ agents }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)

  const push = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(params.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
      }
      next.delete('page')
      router.push(`/vendedores?${next.toString()}`)
    },
    [params, router]
  )

  const currentStatus = params.get('status') ?? ''
  const currentAgent = params.get('agentId') ?? ''
  const currentBrand = params.get('brand') ?? ''
  const currentPriceMax = params.get('priceMax') ?? ''
  const currentSort = params.get('sort') ?? 'createdAt'
  const currentQ = params.get('q') ?? ''

  const hasFilters = !!(
    currentStatus ||
    currentAgent ||
    currentBrand ||
    currentPriceMax ||
    currentQ
  )

  const sortLabel = SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? 'Entrada ↓'

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = searchRef.current?.value.trim() ?? ''
    push({ q })
  }

  const chipBase =
    'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-[12.5px] font-medium text-[#1e293b] cursor-pointer select-none whitespace-nowrap hover:bg-white transition-colors'
  const chipActive =
    'inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-[#0a0a0a] border-[#0a0a0a] text-[12.5px] font-medium text-white cursor-pointer select-none whitespace-nowrap'

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white p-3">
      {/* Search */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-transparent bg-[#f8fafc] px-3 focus-within:border-[#2563eb] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-[#64748b]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={searchRef}
          defaultValue={currentQ}
          placeholder="Buscar por nombre, email, teléfono o marca…"
          className="flex-1 border-none bg-transparent py-2 text-[13.5px] text-[#0a0a0a] placeholder-[#64748b] outline-none"
        />
        <button type="submit" className="sr-only">
          Buscar
        </button>
      </form>

      {/* Estado chip */}
      <label className="relative cursor-pointer">
        <span className={currentStatus ? chipActive : chipBase}>
          {currentStatus ? (
            <>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: STATUS_COLORS[currentStatus] ?? '#64748b' }}
              />
              {STATUS_OPTIONS.find((o) => o.value === currentStatus)?.label ?? 'Estado'}
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" />
              Estado
            </>
          )}
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 opacity-60"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={currentStatus}
          onChange={(e) => push({ status: e.target.value === '__all__' ? '' : e.target.value })}
        >
          <option value="__all__">Todos los estados</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {/* Marca chip */}
      <label className="relative cursor-pointer">
        <span className={currentBrand ? chipActive : chipBase}>
          {currentBrand ? currentBrand : 'Marca'}
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 opacity-60"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={currentBrand}
          onChange={(e) => push({ brand: e.target.value === '__all__' ? '' : e.target.value })}
        >
          <option value="__all__">Todas las marcas</option>
          {BRAND_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>

      {/* Precio chip */}
      <label className="relative cursor-pointer">
        <span className={currentPriceMax ? chipActive : chipBase}>
          {currentPriceMax
            ? `Pide ≤ ${Number(currentPriceMax).toLocaleString('es-ES')} €`
            : 'Precio máx.'}
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 opacity-60"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={currentPriceMax}
          onChange={(e) => push({ priceMax: e.target.value === '__all__' ? '' : e.target.value })}
        >
          <option value="__all__">Cualquier precio</option>
          {PRICE_OPTIONS.map((v) => (
            <option key={v} value={String(v)}>
              Pide ≤ {v.toLocaleString('es-ES')} €
            </option>
          ))}
        </select>
      </label>

      {/* Agente chip */}
      <label className="relative cursor-pointer">
        <span className={currentAgent ? chipActive : chipBase}>
          {currentAgent === '__none__'
            ? 'Sin asignar'
            : currentAgent
              ? (agents.find((a) => a.id === currentAgent)?.name ?? 'Agente')
              : 'Agente'}
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 opacity-60"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={currentAgent}
          onChange={(e) => push({ agentId: e.target.value === '__all__' ? '' : e.target.value })}
        >
          <option value="__all__">Todos los agentes</option>
          <option value="__none__">Sin asignar</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      {/* Limpiar */}
      {hasFilters && (
        <button
          onClick={() => {
            const view = params.get('view')
            router.push(view && view !== 'todos' ? `/vendedores?view=${view}` : '/vendedores')
          }}
          className="px-2 py-2 text-[12px] text-[#64748b] hover:text-[#0a0a0a]"
        >
          Limpiar
        </button>
      )}

      <div className="flex-1" />

      {/* Ordenar chip */}
      <label className="relative cursor-pointer">
        <span className={chipBase}>
          Ordenar: {sortLabel}
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 opacity-60"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={currentSort}
          onChange={(e) => push({ sort: e.target.value })}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
