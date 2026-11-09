'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function AddBuyerInterestButton({
  save,
  selected,
}: {
  save: () => Promise<{ ok: true; saved: boolean } | { ok: false; error: string }>
  selected: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function add() {
    if (pending) return
    setPending(true)
    setError('')
    try {
      const result = await save()
      if (!result.ok) setError(result.error)
      else {
        setMessage(result.saved ? 'Interés guardado.' : 'Ya estaba seleccionado.')
        router.refresh()
      }
    } catch {
      setError('No se ha podido confirmar. Puedes volver a intentarlo.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-2">
      {selected ? (
        <span className="text-sm font-semibold text-sidebar-primary">En vehículos de interés</span>
      ) : (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={add}>
          {pending ? 'Guardando…' : 'Añadir a vehículos de interés'}
        </Button>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
