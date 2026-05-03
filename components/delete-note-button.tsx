'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteNote } from '@/app/(backoffice)/note-actions'

type Props = { activityId: string }

export function DeleteNoteButton({ activityId }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    await deleteNote(activityId)
    // revalidatePath en el server action refresca la página — no hay que limpiar estado local
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <Button
          size="sm"
          variant="destructive"
          className="h-6 px-2 py-0 text-xs"
          disabled={loading}
          onClick={handleConfirm}
        >
          {loading ? '…' : 'Eliminar'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 py-0 text-xs"
          disabled={loading}
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </Button>
      </span>
    )
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-6 w-6 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirming(true)}
      title="Eliminar nota"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}
