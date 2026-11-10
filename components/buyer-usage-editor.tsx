'use client'
import { useState } from 'react'
import { House, MessageCircle } from 'lucide-react'
import { saveBuyerUsage } from '@/app/(backoffice)/compradores/[id]/usage-action'
import { useLabels, type BuyerUsage } from '@/lib/buyer-vehicle-use'

const inputClass =
  'mt-1 block w-full min-w-0 rounded-lg border bg-background px-3 py-2 text-sm text-foreground'
const choices = ['ESCAPADAS', 'VIAJES_LARGOS', 'VIVIENDA', 'OTRO', null] as const
export function BuyerUsageEditor({
  id,
  initial,
  readOnly,
}: {
  id: string
  initial: BuyerUsage
  readOnly: boolean
}) {
  const [draft, setDraft] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const living = draft.intendedUse?.startsWith('VIVIENDA')
  function edit(patch: Partial<BuyerUsage>) {
    setDraft({ ...draft, ...patch })
    setMessage('')
  }
  const dirty =
    draft.intendedUse !== saved.intendedUse ||
    draft.otherUse !== saved.otherUse ||
    draft.useZone !== saved.useZone
  async function save() {
    setBusy(true)
    const after = {
      ...draft,
      otherUse: draft.otherUse?.trim() || null,
      useZone: draft.useZone === saved.useZone ? saved.useZone : draft.useZone?.trim() || null,
    }
    try {
      const result = await saveBuyerUsage({ id, before: saved, after })
      if (result.error) setMessage(result.error)
      else {
        setDraft(after)
        setSaved(after)
        setMessage('Uso guardado.')
      }
    } catch {
      setMessage('No se ha podido confirmar el guardado. Vuelve a intentarlo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5" id="uso-comprador">
      <fieldset disabled={busy || readOnly}>
        <legend className="font-semibold">¿Cómo la va a usar?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {choices.map((mode) => {
            const selected = mode === 'VIVIENDA' ? !!living : draft.intendedUse === mode
            return (
              <button
                type="button"
                key={mode ?? 'pendiente'}
                aria-pressed={selected}
                className={
                  'inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm ' +
                  (selected ? 'border-brand bg-brand text-white' : 'bg-background hover:bg-muted')
                }
                onClick={() => {
                  if (!selected) edit({ intendedUse: mode, otherUse: null })
                }}
              >
                {mode === 'VIVIENDA' && <House size={15} aria-hidden="true" />}
                {mode ? useLabels[mode] : 'Por confirmar'}
              </button>
            )
          })}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {living && (
            <label className="text-sm font-medium">
              ¿Durante cuánto tiempo?
              <select
                className={inputClass}
                value={draft.intendedUse ?? 'VIVIENDA'}
                onChange={(e) => edit({ intendedUse: e.target.value as BuyerUsage['intendedUse'] })}
              >
                <option value="VIVIENDA">Por concretar</option>
                <option value="VIVIENDA_TEMPORADAS">Por temporadas</option>
                <option value="VIVIENDA_ANUAL">Todo el año</option>
              </select>
            </label>
          )}
          {draft.intendedUse === 'OTRO' && (
            <label className="text-sm font-medium">
              ¿Qué uso tiene en mente?
              <input
                className={inputClass}
                maxLength={300}
                value={draft.otherUse ?? ''}
                onChange={(e) => edit({ otherUse: e.target.value || null })}
              />
            </label>
          )}
          <label className="text-sm font-medium">
            Zona de uso
            <input
              className={inputClass}
              value={draft.useZone ?? ''}
              placeholder="Por confirmar"
              onChange={(e) => edit({ useZone: e.target.value || null })}
            />
          </label>
        </div>
        {living && (
          <aside className="mt-4 flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
            <MessageCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <div>
              <strong>Para la conversación</strong>
              <p>¿Cuántos días queréis pasar sin enchufaros ni rellenar agua?</p>
            </div>
          </aside>
        )}
        {!readOnly && dirty && (
          <button
            type="button"
            onClick={save}
            className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
          >
            {busy ? 'Guardando…' : 'Guardar uso'}
          </button>
        )}
      </fieldset>
      <p role="status" className="mt-1 text-sm">
        {message}
      </p>
    </section>
  )
}
