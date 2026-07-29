'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { unpublishVehicle } from './actions'

/**
 * PUB-1 — Retirar anuncio (PUBLICADO → TASADO). Motivo opcional. No se puede si hay ofertas activas
 * (el servidor lo rechaza). Conserva la fecha de primera publicación.
 */
export function UnpublishButton({ vehicleId }: { vehicleId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  function handleUnpublish() {
    startTransition(async () => {
      const res = await unpublishVehicle(vehicleId, { reason: reason.trim() || null })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Anuncio retirado')
      setOpen(false)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Retirar anuncio
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Retirar anuncio del catálogo</p>
      <p className="text-xs text-muted-foreground">
        El vehículo volverá al estado «Tasado» y dejará de aparecer en el catálogo público. Se
        conserva la fecha de primera publicación. No se puede retirar si hay ofertas activas.
      </p>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Motivo (opcional)"
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" onClick={handleUnpublish} disabled={pending}>
          {pending ? 'Retirando…' : 'Confirmar retirada'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
