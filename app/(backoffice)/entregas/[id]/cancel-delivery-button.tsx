'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'
import type { DeliveryStatus } from '@prisma/client'
import { cancelDelivery } from '../actions'

type Props = {
  deliveryId: string
  currentStatus: DeliveryStatus
}

/** I3C2 — cancelación con confirmación + motivo obligatorio. Solo visible en PROGRAMADA/EN_CURSO. */
export function CancelDeliveryButton({ deliveryId, currentStatus }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (currentStatus !== 'PROGRAMADA' && currentStatus !== 'EN_CURSO') return null

  function handleCancel() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError('Indica el motivo de la cancelación.')
      return
    }
    setError(null)
    startTransition(async () => {
      // Se envía el estado esperado (defensa anti-obsoleto): si cambió, el servidor rechaza.
      const res = await cancelDelivery(deliveryId, trimmed, currentStatus)
      if (!res.ok) {
        setError(res.error)
      } else {
        setOpen(false)
        setReason('')
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-line bg-card px-[15px] font-hanken text-[13px] font-semibold text-bad transition-colors hover:bg-bad-tint"
      >
        <XCircle className="h-4 w-4" />
        Cancelar entrega
      </button>

      {/* No permitir cerrar el diálogo mientras se está enviando (evita perder el resultado). */}
      <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar entrega</DialogTitle>
            <DialogDescription>
              La entrega pasará a <strong>Cancelada</strong> con el motivo que indiques.{' '}
              <strong>No se libera automáticamente el vehículo</strong> ni se modifica la operación
              (la oferta permanece intacta). Podrás programar una nueva entrega para este vehículo
              si hace falta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                Motivo de la cancelación <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                autoFocus
                placeholder="Ej.: el comprador aplaza la recogida a la próxima semana"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && <p className="text-[13px] text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Volver
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleCancel}>
              {isPending ? 'Cancelando…' : 'Cancelar entrega'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
