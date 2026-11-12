'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ChecklistItemCategory, ChecklistItemResult } from '@prisma/client'
import { addInspectionItem, saveInspectionReview } from '../actions'
import { Button } from '@/components/ui/button'

export type ReviewItem = {
  id: string
  item: string
  category: ChecklistItemCategory
  installed: boolean | null
  catalogAtLoad: boolean | null
  result: ChecklistItemResult
  ownerQuote: boolean
  notes: string | null
  version: string
}
const categories = { MECANICA: 'Mecánica', CAMPER: 'Camper', ELECTRICIDAD: 'Electricidad' }
const results = {
  PENDIENTE: 'Por comprobar',
  OK: 'En buen estado',
  NECESITA_REPARACION: 'Necesita reparación',
  NO_APLICA: 'No aplica',
}
const field = 'block w-full rounded-md border bg-card px-2 py-2 text-sm'
function InspectionElement({
  row,
  orderId,
  editable,
}: {
  row: ReviewItem
  orderId: string
  editable: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = useState({
    installed: row.installed,
    result: row.result,
    ownerQuote: row.ownerQuote,
    notes: row.notes ?? '',
  })
  const [saving, setSaving] = useState(false),
    [error, setError] = useState('')
  const dirty =
    draft.installed !== row.installed ||
    draft.result !== row.result ||
    draft.ownerQuote !== row.ownerQuote ||
    draft.notes !== (row.notes ?? '')
  async function save() {
    setSaving(true)
    setError('')
    try {
      const r = await saveInspectionReview(orderId, row.id, {
        ...draft,
        version: row.version,
        catalogAtLoad: row.catalogAtLoad,
      })
      if (r.error) setError(r.error)
      else router.refresh()
    } catch {
      setError('No se ha confirmado el guardado. Comprueba la ficha y vuelve a intentarlo.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <fieldset
      aria-label={row.item}
      disabled={!editable || saving}
      className="space-y-2 border-t py-3"
    >
      <legend className="px-1 text-sm font-semibold">{row.item}</legend>
      {row.catalogAtLoad !== null && row.catalogAtLoad !== draft.installed && (
        <p className="text-xs text-muted-foreground">
          Ficha del vehículo · {row.catalogAtLoad ? 'Consta instalado' : 'Consta como ausente'}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          ¿Lo lleva?
          <select
            className={field}
            value={draft.installed === null ? '' : String(draft.installed)}
            onChange={(e) => {
              const installed = e.target.value === '' ? null : e.target.value === 'true'
              setDraft({
                ...draft,
                installed,
                result:
                  installed === false
                    ? 'NO_APLICA'
                    : draft.result === 'NO_APLICA'
                      ? 'PENDIENTE'
                      : draft.result,
              })
            }}
          >
            <option value="">Por comprobar</option>
            <option value="true">Sí, lo lleva</option>
            <option value="false">No lo lleva</option>
          </select>
        </label>
        <label className="text-xs">
          Estado
          <select
            className={field}
            disabled={draft.installed === false && draft.result === 'NO_APLICA'}
            value={draft.result}
            onChange={(e) => setDraft({ ...draft, result: e.target.value as ChecklistItemResult })}
          >
            {Object.entries(results)
              .filter(
                ([id]) => draft.installed !== false || id === 'PENDIENTE' || id === 'NO_APLICA'
              )
              .map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label className="block text-xs">
        Observaciones
        <input
          className={field}
          maxLength={2000}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.ownerQuote}
            onChange={(e) => setDraft({ ...draft, ownerQuote: e.target.checked })}
          />
          Presupuestar al propietario
        </label>
        {editable && dirty && (
          <Button type="button" size="sm" onClick={save}>
            {saving ? 'Guardando…' : 'Guardar elemento'}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}

export function InspectionReview({
  rows,
  orderId,
  editable,
}: {
  rows: ReviewItem[]
  orderId: string
  editable: boolean
}) {
  const router = useRouter(),
    [adding, setAdding] = useState(false),
    [error, setError] = useState('')
  const quote = rows.filter((r) => r.ownerQuote)
  async function add(form: HTMLFormElement) {
    const data = new FormData(form)
    setAdding(true)
    setError('')
    try {
      const r = await addInspectionItem(orderId, {
        item: data.get('item'),
        category: data.get('category'),
      })
      if (r.error) setError(r.error)
      else {
        form.reset()
        router.refresh()
      }
    } catch {
      setError('No se pudo añadir el elemento.')
    } finally {
      setAdding(false)
    }
  }
  return (
    <section id="inspeccion-entrada" className="scroll-mt-4 space-y-4">
      <h2 className="text-lg font-semibold">Inspección de entrada</h2>
      <section
        aria-label="Para presupuestar al propietario"
        className="rounded-lg border bg-brand-tint p-3"
      >
        <h3 className="font-semibold">Para presupuestar al propietario · {quote.length}</h3>
        {quote.length ? (
          <ul className="list-disc pl-5">
            {quote.map((r) => (
              <li key={r.id}>
                {r.item}
                {r.notes && ' · ' + r.notes}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">Todavía no hay partidas marcadas.</p>
        )}
      </section>
      {(Object.keys(categories) as ChecklistItemCategory[]).map((c) => {
        const group = rows.filter((r) => r.category === c)
        return (
          <details key={c} className="rounded-lg border bg-card p-3">
            <summary className="cursor-pointer font-semibold">
              {categories[c]} · {group.filter((r) => r.result !== 'PENDIENTE').length} de{' '}
              {group.length} revisados
            </summary>
            {group.map((r) => (
              <InspectionElement
                key={r.id + r.version}
                row={r}
                orderId={orderId}
                editable={editable}
              />
            ))}
          </details>
        )
      })}
      {editable && (
        <form
          className="space-y-2 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            void add(e.currentTarget)
          }}
        >
          <h3 className="font-semibold">Añadir otro elemento</h3>
          <label className="block text-xs">
            Elemento
            <input required name="item" maxLength={100} className={field} />
          </label>
          <label className="block text-xs">
            Categoría
            <select className={field} name="category" defaultValue="CAMPER">
              {Object.entries(categories).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm" disabled={adding}>
            Añadir elemento
          </Button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </section>
  )
}
