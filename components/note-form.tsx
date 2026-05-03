'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const MAX = 2000

type Props = {
  addNote: (content: string) => Promise<{ ok?: boolean; error?: string }>
}

export function NoteForm({ addNote }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    setError(null)
    const result = await addNote(content)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setContent('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        placeholder="Escribe una nota…"
        rows={3}
        maxLength={MAX}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={loading}
        className="resize-none"
      />
      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${content.length >= MAX ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {content.length}/{MAX}
        </span>
        <Button type="submit" size="sm" disabled={loading || !content.trim()}>
          {loading ? 'Guardando…' : 'Añadir nota'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}
