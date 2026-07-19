'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Ban, MoreHorizontal, Copy, ExternalLink } from 'lucide-react'
import { discardSellerLead } from './actions'
import { LOST_REASON_OPTIONS } from '@/lib/lost-reason'

type Props = {
  leadId: string
  isTerminal: boolean
}

export function SellerTopbarActions({ leadId, isTerminal }: Props) {
  const [discardOpen, setDiscardOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDiscard() {
    if (!reason) {
      setError('Selecciona el motivo del descarte')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await discardSellerLead(leadId, reason, notes)
      if (result.error) {
        setError(result.error)
      } else {
        setDiscardOpen(false)
        router.refresh()
      }
    })
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).catch(console.error)
  }

  return (
    <>
      <button
        onClick={() => !isTerminal && setDiscardOpen(true)}
        disabled={isTerminal}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        title={isTerminal ? 'Lead en estado final' : 'Descartar vendedor'}
      >
        <Ban className="h-4 w-4" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={handleCopyLink}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copiar enlace
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open(window.location.href, '_blank')}>
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            Abrir en nueva pestaña
          </DropdownMenuItem>
          {!isTerminal && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDiscardOpen(true)}
                className="text-amber-600 focus:bg-amber-50 focus:text-amber-700"
              >
                <Ban className="mr-2 h-3.5 w-3.5" />
                Descartar vendedor
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar vendedor</DialogTitle>
            <DialogDescription>
              Es una <strong>decisión comercial</strong>: el vendedor pasará al estado{' '}
              <strong>Descartado</strong> con el motivo que indiques. No se elimina ningún dato y el
              registro <strong>seguirá visible</strong> en la bandeja y en la búsqueda (no se
              archiva ni se oculta). <strong>Descartado es un estado final</strong>: no podrá
              revertirse desde la ficha.
            </DialogDescription>
          </DialogHeader>
          {/* CAM-61: motivo estructurado */}
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                Motivo del descarte <span className="text-red-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecciona un motivo…</option>
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
                placeholder="Ej.: pide 15.000 € por encima de la tasación y no negocia"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && <p className="text-[13px] text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleDiscard}>
              {isPending ? 'Procesando…' : 'Descartar vendedor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
