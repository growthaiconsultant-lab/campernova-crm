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
import { archiveSellerLead } from './actions'

type Props = {
  leadId: string
  isTerminal: boolean
}

export function SellerTopbarActions({ leadId, isTerminal }: Props) {
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveSellerLead(leadId)
      if (!result.error) {
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
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        title={isTerminal ? 'Lead en estado final' : 'Descartar lead'}
      >
        <Archive className="h-4 w-4" />
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
                onClick={() => setArchiveOpen(true)}
                className="text-amber-600 focus:bg-amber-50 focus:text-amber-700"
              >
                <Archive className="mr-2 h-3.5 w-3.5" />
                Descartar lead
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar lead</DialogTitle>
            <DialogDescription>
              El lead pasará al estado <strong>Descartado</strong>. Quedará registrado que no
              continuó el proceso. Puedes reactivarlo editando el estado manualmente si el vendedor
              vuelve a contactar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleArchive}>
              {isPending ? 'Procesando…' : 'Descartar lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
