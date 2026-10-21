'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export type BuyerCommercialNote = {
  id: string
  content: string | null
  createdAt: string
  author: string
}

export function BuyerNotesPanel({
  notes,
  addNote,
  pagination,
  afterSaveHref,
}: {
  notes: BuyerCommercialNote[]
  addNote: (content: string) => Promise<{ ok?: boolean; error?: string }>
  pagination?: React.ReactNode
  afterSaveHref?: string
}) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const saving = useRef(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving.current || !content.trim()) return
    saving.current = true
    setPending(true)
    setError(null)
    setSuccess(false)
    try {
      const result = await addNote(content)
      if (result.error) setError(result.error)
      else {
        setContent('')
        setSuccess(true)
        if (afterSaveHref) router.replace(afterSaveHref, { scroll: false })
        router.refresh()
      }
    } catch {
      setError(
        'No se ha podido guardar la nota. El texto se conserva para que puedas volver a intentarlo.'
      )
    } finally {
      saving.current = false
      setPending(false)
    }
  }

  return (
    <section
      aria-labelledby="buyer-notes-title"
      className="min-w-0 rounded-xl border border-border bg-card p-5"
    >
      <h2 id="buyer-notes-title" className="scroll-mt-20 text-base font-semibold">
        Notas comerciales
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Lo que habéis hablado y lo que necesita el comprador.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-2">
        <label htmlFor="buyer-note" className="block text-sm font-medium">
          Añadir una nota
        </label>
        <Textarea
          id="buyer-note"
          value={content}
          onChange={(event) => {
            setContent(event.target.value)
            setSuccess(false)
          }}
          placeholder="Ej.: He hablado con él hoy. Busca una camper de 4 plazas; le enviaré dos opciones."
          maxLength={2000}
          rows={3}
          disabled={pending}
          required
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{content.length}/2000</span>
          <Button type="submit" size="sm" disabled={pending || !content.trim()}>
            {pending ? 'Guardando…' : 'Guardar nota'}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-emerald-700">
            Nota guardada. También queda registrada en Actividad.
          </p>
        )}
      </form>
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-medium">Historial de notas</h3>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay notas de los comerciales.</p>
        ) : (
          <ol className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg border border-border p-3">
                <p className="whitespace-pre-wrap break-words text-sm">{note.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">{note.author}</span> · Registrada el{' '}
                  <time dateTime={note.createdAt}>
                    {new Date(note.createdAt).toLocaleString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Europe/Madrid',
                    })}
                  </time>
                </p>
              </li>
            ))}
          </ol>
        )}
        {pagination}
      </div>
    </section>
  )
}
