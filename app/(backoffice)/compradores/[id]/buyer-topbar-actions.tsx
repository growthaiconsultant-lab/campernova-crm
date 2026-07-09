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
import { Archive, MoreHorizontal, Copy, ExternalLink } from 'lucide-react'
import { archiveBuyerLead } from './actions'
import { LOST_REASON_OPTIONS } from '@/lib/lost-reason'

type Props = {
  leadId: string
  isTerminal: boolean
}

export function BuyerTopbarActions({ leadId, isTerminal }: Props) {
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleArchive() {
    if (!reason) {
      setError('Selecciona el motivo de la pérdida')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await archiveBuyerLead(leadId, reason, notes)
      if (result.error) {
        setError(result.error)
      } else {
        setArchiveOpen(false)
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
        onClick={() => !isTerminal && setArchiveOpen(true)}
        disabled={isTerminal}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e6e9ee] text-[#586173] transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
        title={isTerminal ? 'Lead en estado final' : 'Marcar como perdido'}
      >
        <Archive className="h-4 w-4" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e6e9ee] text-[#586173] transition-colors hover:bg-[#f8fafc]">
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
                onClick={() => setArchiveOpen(true)}
                className="text-amber-600 focus:bg-amber-50 focus:text-amber-700"
              >
                <Archive className="mr-2 h-3.5 w-3.5" />
                Marcar como perdido
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar lead como perdido</DialogTitle>
            <DialogDescription>
              El lead pasará al estado <strong>Perdido</strong>. Quedará registrado que el comprador
              no finalizó la compra. Podrás reactivarlo editando el estado manualmente si cambia de
              opinión.
            </DialogDescription>
          </DialogHeader>
          {/* CAM-61: motivo estructurado */}
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                Motivo de la pérdida <span className="text-red-500">*</span>
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
                placeholder="Ej.: encontró una perfilada más barata en un concesionario de Girona"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && <p className="text-[13px] text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleArchive}>
              {isPending ? 'Procesando…' : 'Marcar como perdido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
