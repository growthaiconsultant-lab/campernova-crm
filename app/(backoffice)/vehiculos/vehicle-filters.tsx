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
  { value: 'TASADO', label: 'Tasado' },
  { value: 'PUBLICADO', label: 'Publicado' },
  { value: 'RESERVADO', label: 'Reservado' },
  { value: 'VENDIDO', label: 'Vendido' },
  { value: 'DESCARTADO', label: 'Descartado' },
]

const TYPE_OPTIONS = [
  { value: 'CAMPER', label: 'Camper' },
  { value: 'AUTOCARAVANA', label: 'Autocaravana' },
]

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Fecha entrada' },
  { value: 'year', label: 'Año' },
  { value: 'km', label: 'Kilómetros' },
  { value: 'valuationRecommended', label: 'Precio tasado' },
]

export function VehicleFilters() {
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
      router.push(`/vehiculos?${next.toString()}`)
    },
    [params, router]
  )

  const handleBrandSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const brand = new FormData(e.currentTarget).get('brand') as string
    push('brand', brand.trim())
  }

  const hasFilters =
    params.has('brand') ||
    params.has('status') ||
    params.has('type') ||
    params.has('yearMin') ||
    params.has('yearMax') ||
    params.has('kmMax') ||
    params.has('priceMax')

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Marca */}
      <form onSubmit={handleBrandSubmit} className="flex gap-2">
        <Input
          name="brand"
          defaultValue={params.get('brand') ?? ''}
          placeholder="Marca o modelo…"
          className="w-44"
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
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Tipo */}
      <Select
        value={params.get('type') ?? ''}
        onValueChange={(v) => push('type', v === '__all__' ? '' : v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos los tipos</SelectItem>
          {TYPE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Año desde */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Año desde</label>
        <Input
          type="number"
          value={params.get('yearMin') ?? ''}
          onChange={(e) => push('yearMin', e.target.value)}
          placeholder="2010"
          className="w-24"
          min={1990}
          max={new Date().getFullYear()}
        />
      </div>

      {/* Año hasta */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Año hasta</label>
        <Input
          type="number"
          value={params.get('yearMax') ?? ''}
          onChange={(e) => push('yearMax', e.target.value)}
          placeholder={String(new Date().getFullYear())}
          className="w-24"
          min={1990}
          max={new Date().getFullYear()}
        />
      </div>

      {/* Km máx */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Km máx</label>
        <Input
          type="number"
          value={params.get('kmMax') ?? ''}
          onChange={(e) => push('kmMax', e.target.value)}
          placeholder="150000"
          className="w-28"
          min={0}
          step={5000}
        />
      </div>

      {/* Precio máx */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Precio máx</label>
        <Input
          type="number"
          value={params.get('priceMax') ?? ''}
          onChange={(e) => push('priceMax', e.target.value)}
          placeholder="80000"
          className="w-28"
          min={0}
          step={1000}
        />
      </div>

      {/* Ordenar */}
      <Select value={params.get('sort') ?? 'createdAt'} onValueChange={(v) => push('sort', v)}>
        <SelectTrigger className="w-44">
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
        <Button variant="ghost" size="sm" onClick={() => router.push('/vehiculos')}>
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}
