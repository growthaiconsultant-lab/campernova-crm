'use client'

import { useCallback, useRef, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { updateVehiclePublicNotes } from '@/app/(backoffice)/vendedores/[id]/ads-actions'

type Props = {
  vehicleId: string
  initialValue?: string | null
}

export function PublicNotesEditor({ vehicleId, initialValue }: Props) {
  const [value, setValue] = useState(initialValue ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(
    async (text: string) => {
      setStatus('saving')
      const result = await updateVehiclePublicNotes(vehicleId, text)
      setStatus(result.error ? 'error' : 'saved')
      setTimeout(() => setStatus('idle'), 2000)
    },
    [vehicleId]
  )

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    setValue(text)
    setStatus('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(text), 1000)
  }

  const statusText =
    status === 'saving'
      ? 'Guardando…'
      : status === 'saved'
        ? 'Guardado ✓'
        : status === 'error'
          ? 'Error al guardar'
          : ''

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor="public-notes">Notas del agente</Label>
        <span
          className={`text-xs ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {statusText}
        </span>
      </div>
      <Textarea
        id="public-notes"
        value={value}
        onChange={handleChange}
        placeholder="ITV pasada en marzo, neumáticos nuevos, toldo Fiamma F45, cargador B2B 50A…"
        rows={3}
        className="resize-none"
      />
      <p className="text-xs text-muted-foreground">
        Se incluye en el contexto del anuncio. Detalla revisiones, extras no homologados, estado
        real.
      </p>
    </div>
  )
}
