'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { overrideValuation } from './actions'

type Props = { vehicleId: string }

export function ValuationOverrideForm({ vehicleId }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setPending(true)

    const fd = new FormData(e.currentTarget)
    const data = {
      min: Number(fd.get('min')),
      recommended: Number(fd.get('recommended')),
      max: Number(fd.get('max')),
    }

    const result = await overrideValuation(vehicleId, data)
    setPending(false)

    if (result.error) {
      const msgs = [
        ...('formErrors' in result.error ? result.error.formErrors : []),
        ...Object.values('fieldErrors' in result.error ? result.error.fieldErrors : {}).flat(),
      ]
      setError(msgs.join(' · ') || 'Error desconocido')
    } else {
      setSuccess(true)
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Sobrescribir tasación
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="min" className="text-xs">
            Mínimo (€)
          </Label>
          <Input id="min" name="min" type="number" min={0} step={100} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="recommended" className="text-xs">
            Recomendado (€)
          </Label>
          <Input id="recommended" name="recommended" type="number" min={0} step={100} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="max" className="text-xs">
            Máximo (€)
          </Label>
          <Input id="max" name="max" type="number" min={0} step={100} required />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">Tasación guardada.</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
