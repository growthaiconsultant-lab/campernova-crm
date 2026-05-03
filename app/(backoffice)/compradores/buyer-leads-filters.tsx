'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const STATUS_OPTIONS = [
  { value: 'NUEVO', label: 'Nuevo' },
  { value: 'CONTACTADO', label: 'Contactado' },
  { value: 'CUALIFICADO', label: 'Cualificado' },
  { value: 'EN_NEGOCIACION', label: 'En negociación' },
  { value: 'CERRADO', label: 'Cerrado' },
  { value: 'PERDIDO', label: 'Perdido' },
]

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Fecha entrada' },
  { value: 'updatedAt', label: 'Última actualización' },
  { value: 'maxBudget', label: 'Presupuesto' },
]

type Agent = { id: string; name: string }
type Props = { agents: Agent[] }

export function BuyerLeadsFilters({ agents }: Props) {
  const router = useRouter()
  const params = useSearchParams()

  const push = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString())
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      next.delete('page')
      router.push(`/compradores?${next.toString()}`)
    },
    [params, router]
  )

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q') as string
    push('q', q.trim())
  }

  const hasFilters =
    params.has('q') ||
    params.has('status') ||
    params.has('agentId') ||
    params.has('dateFrom') ||
    params.has('dateTo') ||
    params.has('budgetMin') ||
    params.has('seatsMin')

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Búsqueda libre */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <Input
          name="q"
          defaultValue={params.get('q') ?? ''}
          placeholder="Nombre, email o teléfono…"
          className="w-56"
        />
        <Button type="submit" variant="secondary" size="sm">
          Buscar
        </Button>
      </form>

      {/* Estado */}
      <Select
        value={params.get('status') ?? ''}
        onValueChange={(v) => push('status', v === '__all__' ? '' : v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos los estados</SelectItem>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Agente */}
      <Select
        value={params.get('agentId') ?? ''}
        onValueChange={(v) => push('agentId', v === '__all__' ? '' : v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Agente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos los agentes</SelectItem>
          <SelectItem value="__none__">Sin asignar</SelectItem>
          {agents.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Presupuesto mínimo */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Presupuesto mín. (€)</label>
        <Input
          type="number"
          min={0}
          step={1000}
          placeholder="Ej: 30000"
          defaultValue={params.get('budgetMin') ?? ''}
          onBlur={(e) => push('budgetMin', e.target.value)}
          className="w-32"
        />
      </div>

      {/* Plazas mínimas requeridas */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Plazas mín.</label>
        <Input
          type="number"
          min={1}
          max={20}
          placeholder="Ej: 4"
          defaultValue={params.get('seatsMin') ?? ''}
          onBlur={(e) => push('seatsMin', e.target.value)}
          className="w-24"
        />
      </div>

      {/* Fecha desde */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Desde</label>
        <Input
          type="date"
          value={params.get('dateFrom') ?? ''}
          onChange={(e) => push('dateFrom', e.target.value)}
          className="w-36"
        />
      </div>

      {/* Fecha hasta */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Hasta</label>
        <Input
          type="date"
          value={params.get('dateTo') ?? ''}
          onChange={(e) => push('dateTo', e.target.value)}
          className="w-36"
        />
      </div>

      {/* Ordenar */}
      <Select value={params.get('sort') ?? 'createdAt'} onValueChange={(v) => push('sort', v)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Dir */}
      <Select value={params.get('dir') ?? 'desc'} onValueChange={(v) => push('dir', v)}>
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">↓ Reciente</SelectItem>
          <SelectItem value="asc">↑ Antiguo</SelectItem>
        </SelectContent>
      </Select>

      {/* Limpiar */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push('/compradores')}>
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}
