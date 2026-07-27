'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { officialAutoValuation, officialManualValuation } from './actions'

type Props = {
  vehicleId: string
  /** Gate de UI: entrada activa + inspección COMPLETADA + estado elegible. */
  gateReady: boolean
  /** Motivo por el que el gate no está listo (vacío si listo). */
  gateReason: string
}

type ActionError = { formErrors?: string[]; fieldErrors?: Record<string, string[]> }

function flattenError(error: ActionError | undefined): string {
  if (!error) return 'Error desconocido'
  const msgs = [...(error.formErrors ?? []), ...Object.values(error.fieldErrors ?? {}).flat()]
  return msgs.join(' · ') || 'Error desconocido'
}

/**
 * Panel de TASACIÓN OFICIAL (A3). Distinto de la valoración preliminar: solo disponible cuando el
 * gate está listo (entrada activa + inspección COMPLETADA). Ofrece tasación automática (algoritmo) o
 * manual (con confianza declarada + motivo). Escribe el precio oficial y puede transicionar
 * `NUEVO → TASADO`.
 */
export function OfficialValuationPanel({ vehicleId, gateReady, gateReason }: Props) {
  const [mode, setMode] = useState<'idle' | 'manual'>('idle')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  if (!gateReady) {
    return (
      <p className="text-xs text-muted-foreground">Tasación oficial no disponible. {gateReason}</p>
    )
  }

  async function handleAuto() {
    setError(null)
    setSuccess(null)
    setPending(true)
    const result = await officialAutoValuation(vehicleId)
    setPending(false)
    if ('error' in result && result.error) {
      setError(flattenError(result.error as ActionError))
    } else if ('outcome' in result && result.outcome === 'SIN_REFERENCIA') {
      setSuccess(
        'Sin datos suficientes para tasar (intento registrado). Prueba la tasación manual.'
      )
    } else {
      setSuccess('Tasación oficial registrada.')
    }
  }

  async function handleManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const data = {
      min: Number(fd.get('min')),
      recommended: Number(fd.get('recommended')),
      max: Number(fd.get('max')),
      confidence: String(fd.get('confidence')),
      reason: String(fd.get('reason') ?? ''),
      notes: (fd.get('notes') as string) || null,
    }
    const result = await officialManualValuation(vehicleId, data)
    setPending(false)
    if (result.error) {
      setError(flattenError(result.error as ActionError))
    } else {
      setSuccess('Tasación oficial manual registrada.')
      setMode('idle')
    }
  }

  return (
    <div className="space-y-2">
      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleAuto} disabled={pending}>
            {pending ? 'Tasando…' : 'Tasar (auto)'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode('manual')} disabled={pending}>
            Tasación manual
          </Button>
        </div>
      )}

      {mode === 'manual' && (
        <form onSubmit={handleManual} className="space-y-3">
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
              <Input
                id="recommended"
                name="recommended"
                type="number"
                min={0}
                step={100}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="max" className="text-xs">
                Máximo (€)
              </Label>
              <Input id="max" name="max" type="number" min={0} step={100} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="confidence" className="text-xs">
                Confianza
              </Label>
              <select
                id="confidence"
                name="confidence"
                required
                defaultValue=""
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Selecciona…
                </option>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Media</option>
                <option value="BAJA">Baja</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reason" className="text-xs">
                Motivo
              </Label>
              <Input id="reason" name="reason" type="text" maxLength={200} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs">
              Observaciones (opcional)
            </Label>
            <Input id="notes" name="notes" type="text" maxLength={1000} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar tasación oficial'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode('idle')}
              disabled={pending}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {error && mode === 'idle' && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
    </div>
  )
}
