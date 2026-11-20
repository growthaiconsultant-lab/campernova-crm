'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveBuyerFollowupTitle } from './followup-title-actions'

export function BuyerFollowupTitleEditor({
  leadId,
  buyerName,
  title,
}: {
  leadId: string
  buyerName: string
  title: string | null
}) {
  const details = useRef<HTMLDetailsElement>(null)
  const saving = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current) return
    const value = new FormData(event.currentTarget).get('title')
    saving.current = true
    setPending(true)
    setError(undefined)
    try {
      const result = await saveBuyerFollowupTitle({ leadId, previousTitle: title, title: value })
      if (result.error) setError(result.error)
      else if (details.current) details.current.open = false
    } catch {
      setError('No se ha podido guardar el título. Vuelve a intentarlo.')
    } finally {
      saving.current = false
      setPending(false)
    }
  }

  return (
    <details ref={details} className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold text-brand">
        {title ? 'Editar título' : 'Añadir título'}
      </summary>
      <form className="mt-2 space-y-2" onSubmit={submit}>
        <Input
          key={title ?? ''}
          name="title"
          aria-label={`Título comercial de ${buyerName}`}
          defaultValue={title ?? ''}
          placeholder="Busca Mercedes Marco Polo"
          maxLength={120}
          disabled={pending}
        />
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar título'}
        </Button>
      </form>
    </details>
  )
}
