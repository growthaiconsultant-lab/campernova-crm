'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  updateVehicleLegalFields,
  markChargesChecked,
} from '@/app/(backoffice)/vendedores/[id]/legal-actions'
import { CheckCircle2, Shield } from 'lucide-react'

interface Props {
  vehicleId: string
  isAdmin: boolean
  plate: string | null
  vin: string | null
  itvValidUntil: Date | null
  titleTransferredAt: Date | null
  chargeCheckedAt: Date | null
  chargeCheckedByName: string | null
}

function toInputDate(d: Date | null): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

export function VehicleLegalFieldsForm({
  vehicleId,
  isAdmin,
  plate,
  vin,
  itvValidUntil,
  titleTransferredAt,
  chargeCheckedAt,
  chargeCheckedByName,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [isChargesPending, startChargesTransition] = useTransition()

  const [values, setValues] = useState({
    plate: plate ?? '',
    vin: vin ?? '',
    itvValidUntil: toInputDate(itvValidUntil),
    titleTransferredAt: toInputDate(titleTransferredAt),
  })

  function handleChange(field: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updateVehicleLegalFields(vehicleId, {
        plate: values.plate || null,
        vin: values.vin || null,
        itvValidUntil: values.itvValidUntil || null,
        titleTransferredAt: values.titleTransferredAt || null,
      })
      if (res.ok) {
        toast.success('Datos legales guardados')
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleMarkCharges() {
    startChargesTransition(async () => {
      const res = await markChargesChecked(vehicleId)
      if (res.ok) {
        toast.success('Cargas DGT marcadas como verificadas')
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Matrícula */}
        <div className="space-y-1.5">
          <Label htmlFor="plate" className="text-xs font-medium">
            Matrícula <span className="text-destructive">*</span>
          </Label>
          {isAdmin ? (
            <Input
              id="plate"
              value={values.plate}
              onChange={(e) => handleChange('plate', e.target.value.toUpperCase())}
              placeholder="1234-ABC"
              className="h-8 font-mono text-sm"
            />
          ) : (
            <p className="font-mono text-sm">{plate ?? '—'}</p>
          )}
        </div>

        {/* VIN */}
        <div className="space-y-1.5">
          <Label htmlFor="vin" className="text-xs font-medium">
            VIN / Bastidor <span className="text-destructive">*</span>
          </Label>
          {isAdmin ? (
            <Input
              id="vin"
              value={values.vin}
              onChange={(e) => handleChange('vin', e.target.value.toUpperCase())}
              placeholder="WDB9634032R123456"
              className="h-8 font-mono text-sm"
            />
          ) : (
            <p className="font-mono text-sm">{vin ?? '—'}</p>
          )}
        </div>

        {/* ITV válida hasta */}
        <div className="space-y-1.5">
          <Label htmlFor="itvValidUntil" className="text-xs font-medium">
            ITV válida hasta <span className="text-destructive">*</span>
          </Label>
          {isAdmin ? (
            <Input
              id="itvValidUntil"
              type="date"
              value={values.itvValidUntil}
              onChange={(e) => handleChange('itvValidUntil', e.target.value)}
              className="h-8 text-sm"
            />
          ) : (
            <p className="text-sm">
              {itvValidUntil ? itvValidUntil.toLocaleDateString('es-ES') : '—'}
            </p>
          )}
        </div>

        {/* Fecha transferencia titularidad */}
        <div className="space-y-1.5">
          <Label htmlFor="titleTransferredAt" className="text-xs font-medium">
            Transferencia de titularidad
          </Label>
          {isAdmin ? (
            <Input
              id="titleTransferredAt"
              type="date"
              value={values.titleTransferredAt}
              onChange={(e) => handleChange('titleTransferredAt', e.target.value)}
              className="h-8 text-sm"
            />
          ) : (
            <p className="text-sm">
              {titleTransferredAt ? titleTransferredAt.toLocaleDateString('es-ES') : '—'}
            </p>
          )}
        </div>
      </div>

      {/* Cargas DGT */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Informe de cargas DGT</p>
              {chargeCheckedAt ? (
                <p className="text-xs text-muted-foreground">
                  Verificado el {chargeCheckedAt.toLocaleDateString('es-ES')}
                  {chargeCheckedByName ? ` por ${chargeCheckedByName}` : ''}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Pendiente de verificar</p>
              )}
            </div>
          </div>
          {chargeCheckedAt ? (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Verificado
            </div>
          ) : isAdmin ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkCharges}
              disabled={isChargesPending}
              className="h-7 text-xs"
            >
              {isChargesPending ? 'Guardando…' : 'Marcar verificado'}
            </Button>
          ) : null}
        </div>
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={isPending} className="h-8">
            {isPending ? 'Guardando…' : 'Guardar datos legales'}
          </Button>
        </div>
      )}
    </div>
  )
}
