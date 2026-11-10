'use client'
import { useState } from 'react'
import { ListPlus, Pencil, Search } from 'lucide-react'
import { CatalogFields } from './match-catalog-fields'
import { saveCatalog } from '@/app/(backoffice)/matches/catalog-actions'
import { catalogFields, type Catalog, type Field } from '@/lib/matching/catalog'

const searchable = (s: string) =>
  s
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
const button =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium'

export function BuyerEquipmentEditor({
  id,
  initial,
  family,
  basicRequirements = [],
}: {
  id: string
  initial: Catalog
  family?: string | null
  basicRequirements?: string[]
}) {
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [field, setField] = useState<Field | null>(null)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const known = catalogFields.filter((f) => saved[f.id])
  const available = catalogFields.filter(
    (f) => !saved[f.id] && (!f.family || !family || f.family === family)
  )
  const terms = searchable(query.trim()).split(/\s+/)
  const matches = available.filter((f) => {
    const words = searchable([f.group, f.label, ...(f.options ?? [])].join(' '))
    return terms.every((t) => words.includes(t))
  })
  function open(f: Field) {
    setField(f)
    setAdding(false)
    setDraft(saved)
    setMessage('')
  }
  async function save() {
    setBusy(true)
    try {
      const result = await saveCatalog({ side: 'buyer', id, before: saved, after: draft })
      if (result.error) setMessage(result.error)
      else {
        setSaved(draft)
        setField(null)
        setQuery('')
        setMessage('Equipamiento guardado.')
      }
    } catch {
      setMessage('No se ha podido confirmar el guardado. Vuelve a intentarlo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rounded-xl border bg-card p-4">
      {!field && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button + ' bg-brand text-white'}
              aria-expanded={adding}
              onClick={() => {
                setAdding(!adding)
                setQuery('')
                setMessage('')
              }}
            >
              <ListPlus size={16} aria-hidden="true" />
              {adding ? 'Cerrar catálogo' : 'Añadir característica'}
            </button>
            {!!known.length && (
              <details className="min-w-0 max-w-full">
                <summary className={button + ' cursor-pointer'}>
                  <Pencil size={14} aria-hidden="true" />
                  Editar características guardadas
                </summary>
                <div className="mt-2 grid gap-1">
                  {known.map((f) => (
                    <button
                      className="min-w-0 rounded px-2 py-2 text-left text-sm [overflow-wrap:anywhere] hover:bg-muted"
                      type="button"
                      key={f.id}
                      onClick={() => open(f)}
                    >
                      {f.label} · {saved[f.id].values.join(saved[f.id].all ? ' y ' : ' o ')}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>
          {adding && (
            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium">
                Buscar característica
                <span className="mt-1 flex items-center gap-2 rounded-lg border px-3">
                  <Search size={15} aria-hidden="true" />
                  <input
                    className="min-w-0 flex-1 bg-transparent py-2"
                    type="search"
                    placeholder="Ducha, cama, placas solares…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </span>
              </label>
              {Array.from(new Set(matches.map((f) => f.group))).map((group) => (
                <details
                  key={group}
                  open={query.trim() ? true : undefined}
                  className="border-b py-1"
                >
                  <summary className="cursor-pointer py-2 text-sm font-medium">{group}</summary>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {matches
                      .filter((f) => f.group === group)
                      .map((f) => (
                        <button type="button" className={button} key={f.id} onClick={() => open(f)}>
                          {f.label}
                        </button>
                      ))}
                  </div>
                </details>
              ))}
              {!matches.length && (
                <p className="text-sm text-muted-foreground">
                  No hay características pendientes que coincidan.
                </p>
              )}
            </div>
          )}
        </>
      )}
      {field && (
        <fieldset disabled={busy} className="space-y-3">
          {basicRequirements.includes(field.id) && (
            <p className="rounded-lg bg-muted p-3 text-sm">
              Esta característica también figura como imprescindible en las preferencias de
              búsqueda.{' '}
              <a
                href={'?tab=busqueda&ver=editar#preferencias-comprador'}
                className="font-medium underline"
              >
                Revisar esa prioridad
              </a>
            </p>
          )}
          <CatalogFields
            buyer
            fieldId={field.id}
            family={family}
            value={draft}
            onChange={(next) => {
              setDraft(next)
              setMessage('')
            }}
          />
          {saved[field.id] && draft[field.id] && (
            <button
              type="button"
              className="text-sm underline"
              onClick={() => {
                const next = { ...draft }
                delete next[field.id]
                setDraft(next)
                setMessage('Se quitará al guardar.')
              }}
            >
              Quitar característica
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button + ' bg-brand text-white disabled:opacity-50'}
              disabled={JSON.stringify(draft) === JSON.stringify(saved)}
              onClick={save}
            >
              {busy ? 'Guardando…' : 'Guardar característica'}
            </button>
            <button
              type="button"
              className={button}
              onClick={() => {
                setField(null)
                setMessage('')
              }}
            >
              Cancelar
            </button>
          </div>
        </fieldset>
      )}
      <p role="status" className="mt-1 text-sm">
        {message}
      </p>
    </div>
  )
}
