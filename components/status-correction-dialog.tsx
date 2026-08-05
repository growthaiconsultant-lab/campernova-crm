'use client'

import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

type ActionResult = { ok: true } | { ok: false; error: string }

type Props = {
  triggerLabel: string
  title: string
  description: string
  confirmLabel: string
  successMessage: string
  destructive?: boolean
  disabled?: boolean
  onConfirm: (reason: string) => Promise<ActionResult>
}

export function StatusCorrectionDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  successMessage,
  destructive = false,
  disabled = false,
  onConfirm,
}: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()
  const reasonId = useId()

  function submit() {
    const normalizedReason = reason.trim()
    if (normalizedReason.length < 3) {
      toast.error('Indica un motivo de al menos 3 caracteres.')
      return
    }
    startTransition(async () => {
      const result = await onConfirm(normalizedReason)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(successMessage)
      setOpen(false)
      setReason('')
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={destructive ? 'destructive' : 'outline'}
          size="sm"
          disabled={disabled}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor={reasonId} className="text-sm font-medium">
            Motivo obligatorio
          </label>
          <Textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explica qué se corrige y por qué…"
            maxLength={500}
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">
            Máximo 500 caracteres. No incluyas DNI, teléfono, email ni otros datos personales.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={submit}
            disabled={isPending || reason.trim().length < 3}
          >
            {isPending ? 'Guardando…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
