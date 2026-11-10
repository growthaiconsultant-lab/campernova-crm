'use client'
import { useState } from 'react'
import { CatalogFields } from './match-catalog-fields'
import { saveCatalog } from '@/app/(backoffice)/matches/catalog-actions'
import type { Catalog } from '@/lib/matching/catalog'
export function CatalogEditor({
  side,
  id,
  initial,
  family,
  heading,
  children,
}: {
  side: 'buyer' | 'vehicle'
  id: string
  initial: Catalog
  heading?: string
  children?: React.ReactNode
  family?: string | null
}) {
  const [value, setValue] = useState(initial),
    [saved, setSaved] = useState(initial),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try {
      const result = await saveCatalog({ side, id, before: saved, after: value })
      if (result.error) setMessage(result.error)
      else {
        setSaved(value)
        setMessage('Características guardadas.')
      }
    } catch {
      setMessage('No se ha podido confirmar el guardado. Vuelve a intentarlo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="rounded-xl border bg-card p-4">
      <summary className="cursor-pointer font-semibold">
        {heading ??
          (side === 'buyer'
            ? 'Preferencias de búsqueda detalladas'
            : 'Características detalladas del vehículo')}
      </summary>
      {children}
      <fieldset disabled={busy} className="mt-3">
        <CatalogFields
          family={family}
          buyer={side === 'buyer'}
          value={value}
          onChange={(v) => {
            setValue(v)
            setMessage('')
          }}
        />
      </fieldset>
      <button
        type="button"
        disabled={busy || JSON.stringify(value) === JSON.stringify(saved)}
        className="mt-3 rounded border px-3 py-2"
        onClick={save}
      >
        {busy ? 'Guardando…' : 'Guardar características'}
      </button>
      <span role="status" className="ml-2">
        {message}
      </span>
    </details>
  )
}
