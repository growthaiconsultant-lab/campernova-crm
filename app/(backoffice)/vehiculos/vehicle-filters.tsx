'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { VEHICLE_ORIGIN_LABELS } from '@/lib/seller-intake'
import {
  criteriaKeys,
  criterionLabel,
  emptyCriteria,
  inventoryError,
  inventoryOrders,
  inventoryPriceStates,
  inventoryTypes,
  inventoryStatuses,
  inventoryUrl,
  type InventoryCriteria,
  type InventoryOrder,
  type Criterion,
} from '@/lib/vehicle-inventory-filters'

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground'
const labelClass = 'grid min-w-0 gap-1 text-sm font-medium'

export function VehicleFilters({
  applied,
  order,
}: {
  applied: InventoryCriteria
  order: InventoryOrder
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(applied)
  const [advanced, setAdvanced] = useState(
    Boolean(applied.origin || applied.yearMin || applied.yearMax || applied.kmMax)
  )
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const keys = criteriaKeys.filter((k) => applied[k])
  const dirty = criteriaKeys.some((k) => draft[k] !== applied[k])

  function field(key: Criterion, value: string) {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      ...(key === 'priceState' && value === 'missing' ? { priceMax: '' } : {}),
    }))
    setError('')
  }
  function navigate(next: InventoryCriteria, nextOrder: InventoryOrder) {
    setDraft(next)
    setError('')
    startTransition(() => router.push(inventoryUrl(next, nextOrder), { scroll: false }))
  }
  function select(
    key: 'type' | 'status' | 'origin' | 'priceState',
    label: string,
    all: string,
    options: Record<string, string>
  ) {
    return (
      <label className={labelClass}>
        {label}
        <select
          className={selectClass}
          value={draft[key]}
          onChange={(e) => field(key, e.target.value)}
        >
          <option value="">{all}</option>
          {Object.entries(options).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>
    )
  }
  function numeric(key: 'priceMax' | 'yearMin' | 'yearMax' | 'kmMax', label: string) {
    return (
      <label className={labelClass}>
        {label}
        <Input
          type="number"
          disabled={key === 'priceMax' && draft.priceState === 'missing'}
          min="0"
          step={key === 'priceMax' ? '0.01' : '1'}
          value={draft[key]}
          onChange={(e) => field(key, e.target.value)}
        />
      </label>
    )
  }
  return (
    <section aria-label="Filtros de vehículos" className="space-y-3 rounded-xl border bg-card p-4">
      <form
        aria-label="Buscar en el inventario"
        onSubmit={(e) => {
          e.preventDefault()
          const next = { ...draft, brand: draft.brand.trim() }
          const message = inventoryError(next)
          if (message) {
            setError(message)
            return
          }
          navigate(next, order)
        }}
      >
        <fieldset disabled={pending} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className={labelClass}>
              Buscar vehículo
              <Input
                type="search"
                maxLength={200}
                placeholder="Marca, modelo o matrícula"
                value={draft.brand}
                onChange={(e) => field('brand', e.target.value)}
              />
            </label>
            {select('type', 'Tipo', 'Todos los tipos', inventoryTypes)}
            {select('status', 'Estado del vehículo', 'Todos los estados', inventoryStatuses)}
            {select('priceState', 'Precio de venta', 'Todos', inventoryPriceStates)}
            {numeric('priceMax', 'Precio de venta máx. (€)')}
          </div>
          <details open={advanced} onToggle={(e) => setAdvanced(e.currentTarget.open)}>
            <summary className="cursor-pointer text-sm font-medium text-brand">Más filtros</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {numeric('yearMin', 'Año desde')}
              {numeric('yearMax', 'Año hasta')}
              {numeric('kmMax', 'Kilómetros máx.')}
              {select('origin', 'Origen', 'Todos los orígenes', VEHICLE_ORIGIN_LABELS)}
            </div>
          </details>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit" size="sm">
              Aplicar filtros
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate({ ...emptyCriteria }, 'createdAt:desc')}
            >
              Limpiar todo
            </Button>
            <label className={labelClass + ' sm:ml-auto'}>
              Ordenar por
              <select
                className={selectClass}
                value={order}
                onChange={(e) => {
                  const nextOrder = e.target.value as InventoryOrder
                  startTransition(() =>
                    router.push(inventoryUrl(applied, nextOrder), { scroll: false })
                  )
                }}
              >
                {Object.entries(inventoryOrders).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {(dirty || pending) && (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            {pending ? 'Actualizando resultados…' : 'Cambios pendientes de aplicar'}
          </p>
        )}
      </form>
      {keys.length > 0 && (
        <div
          aria-label="Filtros aplicados"
          className="flex flex-wrap items-center gap-2 border-t pt-3"
        >
          <span className="text-sm text-muted-foreground">Filtros aplicados</span>
          {keys.map((key) => {
            const label = criterionLabel(key, applied[key])
            return (
              <button
                type="button"
                key={key}
                disabled={pending}
                aria-label={'Quitar ' + label}
                className="max-w-full break-words rounded-md bg-brand-tint px-2 py-1 text-sm text-brand"
                onClick={() => navigate({ ...applied, [key]: '' }, order)}
              >
                {label} <span aria-hidden="true">×</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
