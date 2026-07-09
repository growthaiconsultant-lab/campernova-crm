'use client'

import { useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const STATUS_OPTIONS = [
  { value: 'NUEVO', label: 'Nuevo' },
  { value: 'CONTACTADO', label: 'Contactado' },
  { value: 'CUALIFICADO', label: 'Cualificado' },
  { value: 'EN_NEGOCIACION', label: 'En negociación' },
  { value: 'CERRADO', label: 'Cerrado' },
  { value: 'PERDIDO', label: 'Perdido' },
]

const TYPE_OPTIONS = [
  { value: 'CAMPER', label: 'Camper' },
  { value: 'AUTOCARAVANA', label: 'Autocaravana' },
]

const SOURCE_OPTIONS = [
  { value: 'CHAT', label: 'Chat web' },
  { value: 'PRO', label: 'Formulario web' },
  { value: 'LLAMADA', label: 'Llamada' },
  { value: '__none__', label: 'Backoffice' },
]

// CAM-62: temperatura del lead
const TEMP_OPTIONS = [
  { value: 'HOT', label: 'Caliente', dot: '#d64545' },
  { value: 'WARM', label: 'Templado', dot: '#c9820a' },
  { value: 'COLD', label: 'Frío', dot: '#38bdf8' },
]

type Agent = { id: string; name: string }
type Props = { agents: Agent[] }

// Status dot colors for chip indicator
const STATUS_COLORS: Record<string, string> = {
  NUEVO: '#3a6fd4',
  CONTACTADO: '#7c3aed',
  CUALIFICADO: '#0891b2',
  EN_NEGOCIACION: '#c9820a',
  CERRADO: '#1a9d5f',
  PERDIDO: '#8b94a3',
}

export function BuyerListFilters({ agents }: Props) {
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
      router.push(`/compradores?${next.toString()}`)
    },
    [params, router]
  )

  const currentStatus = params.get('status') ?? ''
  const currentType = params.get('vehicleType') ?? ''
  const currentSource = params.get('source') ?? ''
  const currentAgent = params.get('agentId') ?? ''
  const currentSort = params.get('sort') ?? 'createdAt'
  const currentBudget = params.get('budgetMin') ?? ''
  const currentSeats = params.get('seatsMin') ?? ''
  const currentTemp = params.get('temp') ?? ''
  const currentQ = params.get('q') ?? ''

  const hasFilters =
    currentStatus ||
    currentType ||
    currentSource ||
    currentAgent ||
    currentBudget ||
    currentSeats ||
    currentTemp ||
    currentQ

  const sortLabel =
    currentSort === 'updatedAt'
      ? 'Actualización ↓'
      : currentSort === 'maxBudget'
        ? 'Presupuesto ↓'
        : 'Entrada ↓'

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = searchRef.current?.value.trim() ?? ''
    push({ q })
  }

  const chipBase =
    'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e6e9ee] bg-[#f8fafc] text-[12.5px] font-medium text-[#141922] cursor-pointer select-none whitespace-nowrap hover:bg-white transition-colors'
  const chipActive =
    'inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-primary border-primary text-[12.5px] font-medium text-white cursor-pointer select-none whitespace-nowrap'

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#e6e9ee] bg-white p-3">
      {/* Search */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-transparent bg-[#f8fafc] px-3 focus-within:border-[#3a6fd4] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-[#586173]"
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
          placeholder="Buscar por nombre, email, teléfono, tipo o zona…"
          className="flex-1 border-none bg-transparent py-2 text-[13.5px] text-[#141922] placeholder-[#586173] outline-none"
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
                style={{ background: STATUS_COLORS[currentStatus] ?? '#586173' }}
              />
              {STATUS_OPTIONS.find((o) => o.value === currentStatus)?.label ?? 'Estado'}
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[#3a6fd4]" />
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

      {/* Tipo chip */}
      <label className="relative cursor-pointer">
        <span className={currentType ? chipActive : chipBase}>
          {currentType
            ? (TYPE_OPTIONS.find((o) => o.value === currentType)?.label ?? 'Tipo')
            : 'Tipo'}
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
          value={currentType}
          onChange={(e) =>
            push({ vehicleType: e.target.value === '__all__' ? '' : e.target.value })
          }
        >
          <option value="__all__">Cualquier tipo</option>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {/* Origen chip */}
      <label className="relative cursor-pointer">
        <span className={currentSource ? chipActive : chipBase}>
          {currentSource
            ? (SOURCE_OPTIONS.find((o) => o.value === currentSource)?.label ?? 'Origen')
            : 'Origen'}
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
          value={currentSource}
          onChange={(e) => push({ source: e.target.value === '__all__' ? '' : e.target.value })}
        >
          <option value="__all__">Cualquier origen</option>
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {/* Temperatura chip (CAM-62) */}
      <label className="relative cursor-pointer">
        <span className={currentTemp ? chipActive : chipBase}>
          {currentTemp ? (
            <>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: TEMP_OPTIONS.find((o) => o.value === currentTemp)?.dot ?? '#586173',
                }}
              />
              {TEMP_OPTIONS.find((o) => o.value === currentTemp)?.label ?? 'Temperatura'}
            </>
          ) : (
            'Temperatura'
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
          value={currentTemp}
          onChange={(e) => push({ temp: e.target.value === '__all__' ? '' : e.target.value })}
        >
          <option value="__all__">Cualquier temperatura</option>
          {TEMP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {/* Presupuesto chip */}
      <label className="relative cursor-pointer">
        <span className={currentBudget ? chipActive : chipBase}>
          {currentBudget
            ? `Presup. ≥${Number(currentBudget).toLocaleString('es-ES')} €`
            : 'Presupuesto'}
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
          value={currentBudget}
          onChange={(e) => push({ budgetMin: e.target.value === '__all__' ? '' : e.target.value })}
        >
          <option value="__all__">Cualquier presupuesto</option>
          {[10000, 20000, 30000, 40000, 50000, 60000, 80000].map((v) => (
            <option key={v} value={String(v)}>
              ≥ {v.toLocaleString('es-ES')} €
            </option>
          ))}
        </select>
      </label>

      {/* Plazas chip */}
      <label className="relative cursor-pointer">
        <span className={currentSeats ? chipActive : chipBase}>
          {currentSeats ? `${currentSeats}+ plazas` : 'Plazas'}
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
          value={currentSeats}
          onChange={(e) => push({ seatsMin: e.target.value === '__all__' ? '' : e.target.value })}
        >
          <option value="__all__">Cualquier número</option>
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={String(n)}>
              {n}+ plazas
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

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => router.push('/compradores')}
          className="px-2 py-2 text-[12px] text-[#586173] hover:text-[#141922]"
        >
          Limpiar
        </button>
      )}

      <div className="flex-1" />

      {/* Sort chip */}
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
          <option value="createdAt">Entrada ↓</option>
          <option value="updatedAt">Actualización ↓</option>
          <option value="maxBudget">Presupuesto ↓</option>
        </select>
      </label>
    </div>
  )
}
