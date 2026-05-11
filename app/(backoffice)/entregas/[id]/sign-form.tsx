'use client'

import { useState, useTransition } from 'react'
import { signDelivery, updateDeliveryStatus } from '../actions'

interface Props {
  deliveryId: string
  isSigned: boolean
  signedByName?: string | null
  signedByDni?: string | null
  canComplete: boolean
  status: string
}

export function SignForm({
  deliveryId,
  isSigned,
  signedByName,
  signedByDni,
  canComplete,
  status,
}: Props) {
  const [isPendingSign, startSign] = useTransition()
  const [isPendingComplete, startComplete] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isTerminal = status === 'COMPLETADA' || status === 'CANCELADA'

  function handleSign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const data = {
      signedByName: fd.get('signedByName') as string,
      signedByDni: fd.get('signedByDni') as string,
      signatureUrl: `manual:${Date.now()}`,
    }
    startSign(async () => {
      const res = await signDelivery(deliveryId, data)
      if (!res.ok) setError(res.error)
      else setSuccess('Firma guardada correctamente.')
    })
  }

  function handleComplete() {
    setError(null)
    startComplete(async () => {
      const res = await updateDeliveryStatus(deliveryId, 'COMPLETADA')
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <div className="space-y-6">
      {isSigned ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <p className="text-sm font-medium text-green-800">Entrega firmada</p>
          <p className="mt-1 text-sm text-green-700">
            Firmante: <strong>{signedByName}</strong> · DNI: {signedByDni}
          </p>
        </div>
      ) : (
        !isTerminal && (
          <form
            onSubmit={handleSign}
            className="space-y-4 rounded-xl border border-cn-line bg-white p-5"
          >
            <h3 className="font-semibold">Datos del firmante</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium">
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <input
                  name="signedByName"
                  required
                  placeholder="Nombre del comprador"
                  className="h-9 w-full rounded-lg border border-cn-line px-3 text-sm focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium">
                  DNI / NIE <span className="text-red-500">*</span>
                </label>
                <input
                  name="signedByDni"
                  required
                  placeholder="12345678A"
                  className="h-9 w-full rounded-lg border border-cn-line px-3 text-sm focus:outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isPendingSign}
              className="inline-flex h-9 items-center rounded-lg bg-cn-teal-900 px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isPendingSign ? 'Guardando…' : 'Guardar firma'}
            </button>
          </form>
        )
      )}

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
      )}

      {status === 'EN_CURSO' && (
        <div className="space-y-3 rounded-xl border border-cn-line bg-white p-5">
          <h3 className="font-semibold">Completar entrega</h3>
          <p className="text-sm text-cn-ink-500">
            Al completar: el vehículo pasa a VENDIDO, el match a CERRADO, el comprador a CERRADO y
            se activa la garantía de 12 meses.
          </p>
          {!canComplete && (
            <p className="text-sm text-amber-600">
              Completa todos los ítems del checklist y la firma antes de continuar.
            </p>
          )}
          <button
            onClick={handleComplete}
            disabled={!canComplete || isPendingComplete}
            className="inline-flex h-10 items-center rounded-lg bg-green-700 px-5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPendingComplete ? 'Procesando…' : 'Completar entrega'}
          </button>
        </div>
      )}
    </div>
  )
}
