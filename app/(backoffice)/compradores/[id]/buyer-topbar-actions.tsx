'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { UserX, MoreHorizontal, Copy, ExternalLink } from 'lucide-react'
import { markBuyerLeadLost } from './actions'
import { LOST_REASON_OPTIONS } from '@/lib/lost-reason'

type Props = {
  leadId: string
  isTerminal: boolean
  children: React.ReactNode
}

export function BuyerTopbarActions({ leadId, isTerminal, children }: Props) {
  const [manageOpen, setManageOpen] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleMarkLost() {
    setError(null)
    startTransition(async () => {
      const result = await markBuyerLeadLost(leadId, reason, notes)
      if (result.error) {
        setError(result.error)
      } else {
        setManageOpen(false)
        setLostOpen(false)
        router.refresh()
      }
    })
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyMessage('Enlace copiado.')
    } catch {
      setCopyMessage('Puedes copiar la dirección desde el navegador.')
    }
  }

  return (
    <Dialog
      open={manageOpen}
      onOpenChange={(open) => {
        setManageOpen(open)
        if (!open) {
          setLostOpen(false)
          setError(null)
          setCopyMessage('')
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Gestionar ficha"
          title="Gestionar ficha"
          className="h-11 w-11"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="crm-theme max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl">
        {lostOpen ? (
          <>
            <DialogHeader>
              <DialogTitle>Marcar comprador como perdido</DialogTitle>
              <DialogDescription>
                Es una <strong>pérdida comercial</strong>: el comprador pasará al estado{' '}
                <strong>Perdido</strong>. El motivo es opcional. No se elimina ningún dato y el
                registro
                <strong>seguirá visible</strong> en la bandeja y en la búsqueda (no se archiva ni se
                oculta). Esta clasificación podrá corregirse después desde el selector de estado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  Motivo de la pérdida (opcional)
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Sin especificar por ahora</option>
                  {LOST_REASON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  Detalle (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Ej.: encontró una perfilada más barata en un concesionario de Girona"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {error && <p className="text-[13px] text-red-600">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLostOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button variant="destructive" disabled={isPending} onClick={handleMarkLost}>
                {isPending ? 'Procesando…' : 'Marcar como perdido'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Gestionar ficha</DialogTitle>
              <DialogDescription>Datos comerciales y opciones del comprador.</DialogDescription>
            </DialogHeader>
            {children}
            <DialogClose asChild>
              <Link
                href={`/compradores/${leadId}?tab=busqueda&ver=editar#editar`}
                className="text-sm font-semibold text-brand underline"
              >
                Editar datos del comprador
              </Link>
            </DialogClose>
            <div className="grid gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={handleCopyLink}>
                <Copy size={15} className="mr-2" />
                Copiar enlace
              </Button>
              {copyMessage && (
                <p role="status" className="text-sm">
                  {copyMessage}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink size={15} className="mr-2" />
                Abrir en nueva pestaña
              </Button>
              {!isTerminal && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-amber-700"
                  onClick={() => setLostOpen(true)}
                >
                  <UserX size={15} className="mr-2" />
                  Marcar como perdido
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
