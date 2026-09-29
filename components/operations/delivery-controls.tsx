'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DeliveryKind, DeliveryStatus } from '@prisma/client'
import { changeManualDelivery } from '@/app/(backoffice)/operaciones/actions'
export function DeliveryControls({
  id,
  kind,
  status,
}: {
  id: string
  kind: DeliveryKind
  status: DeliveryStatus
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    router = useRouter()
  if (status === 'COMPLETADA' || status === 'CANCELADA') return null
  async function change(target: 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA') {
    if (pending) return
    const reason = target === 'CANCELADA' ? prompt('Motivo de cancelación:') : undefined
    if (target === 'CANCELADA' && reason === null) return
    if (
      target === 'COMPLETADA' &&
      !confirm(
        kind === 'VENTA'
          ? '¿Confirmas la entrega por venta? Registrará la venta y activará la garantía. Checklist y firma son opcionales.'
          : '¿Confirmas la entrega física? No registrará ninguna venta ni garantía.'
      )
    )
      return
    setPending(true)
    setError('')
    try {
      const r = await changeManualDelivery({ id, target, reason })
      if (!r.ok) setError(r.error)
      else router.refresh()
    } catch {
      setError('No se pudo confirmar. Recarga y comprueba el estado antes de reintentar.')
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === 'PROGRAMADA' && (
          <button
            disabled={pending}
            className="rounded border px-3 py-2"
            onClick={() => change('EN_CURSO')}
          >
            Iniciar
          </button>
        )}
        <button
          disabled={pending}
          className="rounded bg-primary px-3 py-2 text-white"
          onClick={() => change('COMPLETADA')}
        >
          {pending ? 'Guardando…' : 'Completar entrega'}
        </button>
        <button
          disabled={pending}
          className="rounded border px-3 py-2"
          onClick={() => change('CANCELADA')}
        >
          Cancelar entrega
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
