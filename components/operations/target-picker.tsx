'use client'
import { useEffect, useState } from 'react'
import { searchOperationalTargets } from '@/app/(backoffice)/operaciones/actions'
import type { OperationalTarget } from '@/lib/operations-input'
export function TargetPicker({
  type,
  label,
  value,
  onChange,
}: {
  type: OperationalTarget['type']
  label: string
  value: string
  onChange: (id: string, label: string) => void
}) {
  const [query, setQuery] = useState(''),
    [page, setPage] = useState(0)
  const [items, setItems] = useState<Array<{ id: string; label: string }>>([])
  const [selectedLabel, setSelectedLabel] = useState(''),
    [error, setError] = useState('')
  const [loading, setLoading] = useState(true),
    [more, setMore] = useState(false)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const timer = setTimeout(async () => {
      try {
        const result = await searchOperationalTargets({ type, query, page })
        if (cancelled) return
        if (!result.ok) {
          setItems([])
          setError(result.error)
          setMore(false)
        } else {
          setItems(result.items)
          setMore(result.hasMore)
        }
      } catch {
        if (!cancelled) setError('No se pudo buscar. Inténtalo de nuevo.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      cancelled = true
    }
  }, [type, query, page])
  return (
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <input
        aria-label={`Buscar ${label.toLowerCase()}`}
        className="w-full rounded border p-2"
        value={query}
        placeholder={type === 'vehicle' ? 'Matrícula, marca o modelo' : 'Nombre del cliente'}
        onChange={(e) => {
          setQuery(e.target.value)
          setPage(0)
        }}
      />
      {value && <p className="text-sm">Seleccionado: {selectedLabel || value}</p>}
      {loading ? (
        <p role="status">Buscando…</p>
      ) : error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : (
        <>
          <select
            aria-label={label}
            value={items.some((i) => i.id === value) ? value : ''}
            className="w-full rounded border p-2"
            onChange={(e) => {
              const item = items.find((i) => i.id === e.target.value)
              if (item) {
                setSelectedLabel(item.label)
                onChange(item.id, item.label)
              }
            }}
          >
            <option value="">{items.length ? 'Selecciona un resultado' : 'Sin resultados'}</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="flex gap-3 text-sm">
            <button type="button" disabled={!page} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <span>Página {page + 1}</span>
            <button type="button" disabled={!more} onClick={() => setPage(page + 1)}>
              Siguiente
            </button>
          </div>
        </>
      )}
    </fieldset>
  )
}
