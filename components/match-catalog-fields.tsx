'use client'
import { useId, useState } from 'react'
import { catalogFields, type Catalog, type Field } from '@/lib/matching/catalog'

export function CatalogFields({
  buyer,
  family,
  publicForm = false,
  value,
  onChange,
}: {
  publicForm?: boolean
  buyer: boolean
  family?: string | null
  value: Catalog
  onChange: (next: Catalog) => void
}) {
  const prefix = useId()
  const [query, setQuery] = useState('')
  const visible = catalogFields.filter(
    (f) =>
      (!publicForm || !/^use[1-5]$/.test(f.id)) &&
      (!f.family || !family || f.family === family || value[f.id]) &&
      (buyer || !['km', 'year', 'brand', 'model', 'family'].includes(f.id)) &&
      f.label.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))
  )
  function change(
    f: Field,
    values: string[],
    required = value[f.id]?.required ?? (f.kind === 'min' || f.kind === 'max'),
    all = value[f.id]?.all ?? false
  ) {
    const next = { ...value }
    if (values.length)
      next[f.id] = buyer ? { values, required, all: all && values.length > 1 } : { values }
    else delete next[f.id]
    onChange(next)
  }
  return (
    <div className="space-y-3">
      <p>
        {buyer
          ? 'Selecciona lo que buscas. Marca «Imprescindible» solo para una necesidad o un límite firme.'
          : 'Deja sin indicar lo que falte por comprobar. Usa tu criterio para el tamaño del garaje o de la nevera.'}
      </p>
      <label className="block">
        Buscar característica{' '}
        <input
          className="rounded border p-2"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {Array.from(new Set(visible.map((f) => f.group))).map((group) => (
        <details key={group} open={query ? true : undefined} className="rounded border p-3">
          <summary className="cursor-pointer font-medium">{group}</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {visible
              .filter((f) => f.group === group)
              .map((f) => {
                const e = value[f.id],
                  id = prefix + f.id,
                  isFlag = f.options?.join('|') === 'Sí|No'
                return (
                  <fieldset key={f.id} className="rounded border p-2">
                    <legend>{f.label}</legend>
                    {isFlag ? (
                      <select
                        aria-label={f.label}
                        value={e?.values[0] ?? ''}
                        onChange={(ev) => change(f, ev.target.value ? [ev.target.value] : [])}
                      >
                        <option value="">{buyer ? 'Indiferente' : 'Por confirmar'}</option>
                        <option>Sí</option>
                        <option>No</option>
                      </select>
                    ) : f.options ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {(buyer ? f.options : [...f.options, 'No tiene']).map((o) => (
                          <label key={o}>
                            <input
                              type="checkbox"
                              checked={e?.values.includes(o) ?? false}
                              onChange={(ev) =>
                                change(
                                  f,
                                  ev.target.checked
                                    ? o === 'No tiene'
                                      ? [o]
                                      : [...(e?.values ?? []).filter((x) => x !== 'No tiene'), o]
                                    : (e?.values ?? []).filter((x) => x !== o)
                                )
                              }
                            />{' '}
                            {o}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <label htmlFor={id}>
                        {buyer && f.kind !== 'text'
                          ? f.kind === 'max'
                            ? 'Máximo '
                            : 'Mínimo '
                          : ''}
                        <input
                          id={id}
                          aria-label={f.label}
                          className="w-full rounded border p-1"
                          type={f.kind === 'text' ? 'text' : 'number'}
                          min={0}
                          step="any"
                          maxLength={300}
                          value={e?.values[0] ?? ''}
                          onChange={(ev) => change(f, ev.target.value ? [ev.target.value] : [])}
                        />
                      </label>
                    )}
                    {buyer && e && e.values.length > 1 && (
                      <label className="block">
                        <input
                          type="checkbox"
                          checked={!!e.all}
                          onChange={(ev) => change(f, e.values, e.required, ev.target.checked)}
                        />{' '}
                        Necesito todas las opciones seleccionadas
                      </label>
                    )}
                    {buyer && e && (
                      <label className="mt-2 block text-sm">
                        <input
                          type="checkbox"
                          checked={!!e.required}
                          onChange={(ev) => change(f, e.values, ev.target.checked)}
                        />{' '}
                        Imprescindible
                      </label>
                    )}
                  </fieldset>
                )
              })}
          </div>
        </details>
      ))}
      {!visible.length && <p>Sin características para esta búsqueda.</p>}
    </div>
  )
}
