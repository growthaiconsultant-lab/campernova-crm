'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { DeliveryKind } from '@prisma/client'
import { createManualDelivery } from '../../operaciones/actions'
import { TargetPicker } from '@/components/operations/target-picker'
import { DELIVERY_KIND_LABELS } from '@/lib/delivery-kind'
export function NewDeliveryForm({ users }: { users: { id: string; name: string }[] }) {
  const router = useRouter(),
    operationId = useRef<string>('')
  const [pending, setPending] = useState(false),
    [error, setError] = useState('')
  const [kind, setKind] = useState<DeliveryKind | ''>(''),
    [vehicleId, setVehicleId] = useState('')
  const [recipientType, setRecipientType] = useState<'buyerLead' | 'sellerLead'>('sellerLead'),
    [recipientId, setRecipientId] = useState('')
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    setError('')
    const fd = new FormData(e.currentTarget),
      date = new Date(String(fd.get('scheduledAt')))
    if (!vehicleId || !kind || !recipientId || !Number.isFinite(date.getTime())) {
      setError('Selecciona vehículo, tipo, destinatario y fecha.')
      return
    }
    if (!operationId.current) operationId.current = crypto.randomUUID()
    const payload = {
      operationId: operationId.current,
      vehicleId,
      kind,
      recipient: { type: recipientType, id: recipientId },
      scheduledAt: date.toISOString(),
      responsableId: fd.get('responsableId') || null,
      notes: fd.get('notes') || null,
    }
    setPending(true)
    try {
      const result = await createManualDelivery(payload)
      if (!result.ok) setError(result.error)
      else router.push(`/entregas/${result.id}`)
    } catch {
      setError(
        'No se pudo confirmar el guardado. Reintenta sin cambiar los datos para evitar duplicados.'
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border bg-white p-6">
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      <fieldset disabled={pending} className="space-y-4">
        <TargetPicker type="vehicle" label="Vehículo" value={vehicleId} onChange={setVehicleId} />
        <label className="block">
          Tipo de entrega
          <select
            required
            className="mt-1 w-full rounded border p-2"
            value={kind}
            onChange={(e) => {
              const k = e.target.value as DeliveryKind
              setKind(k)
              setRecipientType(k === 'VENTA' ? 'buyerLead' : 'sellerLead')
              setRecipientId('')
            }}
          >
            <option value="">Selecciona el tipo</option>
            {Object.entries(DELIVERY_KIND_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {kind === 'ENTREGA_TALLER' && (
          <label className="block">
            Destinatario
            <select
              className="ml-2 rounded border p-2"
              value={recipientType}
              onChange={(e) => {
                setRecipientType(e.target.value as typeof recipientType)
                setRecipientId('')
              }}
            >
              <option value="sellerLead">Vendedor</option>
              <option value="buyerLead">Comprador</option>
            </select>
          </label>
        )}
        {kind && (
          <TargetPicker
            key={recipientType}
            type={recipientType}
            label={recipientType === 'buyerLead' ? 'Comprador' : 'Vendedor'}
            value={recipientId}
            onChange={setRecipientId}
          />
        )}
        <p className="text-sm text-muted-foreground">
          {kind === 'VENTA'
            ? 'Al completar: se registra la venta y se activa su garantía. No se permite duplicar una venta existente.'
            : 'La entrega física no modifica ventas ni garantías.'}
        </p>
        <label className="block">
          Fecha y hora
          <input
            name="scheduledAt"
            type="datetime-local"
            required
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <label className="block">
          Responsable (opcional)
          <select name="responsableId" className="mt-1 w-full rounded border p-2">
            <option value="">Sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Notas
          <textarea name="notes" maxLength={2000} className="mt-1 w-full rounded border p-2" />
        </label>
        <div className="flex justify-end gap-4">
          <Link href="/entregas">Cancelar</Link>
          <button type="submit" className="rounded bg-primary px-4 py-2 text-white">
            {pending ? 'Guardando…' : 'Crear entrega'}
          </button>
        </div>
      </fieldset>
      {error && (
        <button
          type="button"
          disabled={pending}
          className="text-sm underline"
          onClick={() => {
            if (
              confirm(
                'Comprueba antes que la entrega no se haya creado. ¿Iniciar una solicitud diferente?'
              )
            ) {
              operationId.current = ''
              setError('')
            }
          }}
        >
          Iniciar una solicitud diferente
        </button>
      )}
    </form>
  )
}
