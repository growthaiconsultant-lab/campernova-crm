'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { DeliveryKind } from '@prisma/client'
import { createManualDelivery } from '../../operaciones/actions'
import { TargetPicker } from '@/components/operations/target-picker'
import { DELIVERY_KIND_LABELS } from '@/lib/delivery-kind'
import { manualDeliverySchema, manualDeliveryValidationMessage } from '@/lib/operations-input'
import { BuyerSourceSelect } from '@/components/buyer-source-select'
import type { BuyerSource } from '@/lib/buyer-source'
export function NewDeliveryForm({ users }: { users: { id: string; name: string }[] }) {
  const router = useRouter(),
    operationId = useRef<string>('')
  const [pending, setPending] = useState(false),
    [error, setError] = useState('')
  const [kind, setKind] = useState<DeliveryKind | ''>(''),
    [vehicleId, setVehicleId] = useState('')
  const [recipientType, setRecipientType] = useState<'buyerLead' | 'sellerLead'>('sellerLead'),
    [recipientId, setRecipientId] = useState('')
  const [buyerMode, setBuyerMode] = useState<'existing' | 'new'>('existing')
  const [newBuyer, setNewBuyer] = useState<{
    name: string
    email: string
    phone: string
    source: BuyerSource | null
  }>({ name: '', email: '', phone: '', source: null })
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    setError('')
    const fd = new FormData(e.currentTarget),
      date = new Date(String(fd.get('scheduledAt')))
    const payload = {
      operationId: operationId.current || crypto.randomUUID(),
      vehicleId,
      kind,
      recipient:
        recipientType === 'buyerLead' && buyerMode === 'new'
          ? { type: 'newBuyer', ...newBuyer }
          : { type: recipientType, id: recipientId },
      scheduledAt: Number.isFinite(date.getTime()) ? date.toISOString() : '',
      responsableId: fd.get('responsableId') || null,
      notes: fd.get('notes') || null,
    }
    const parsed = manualDeliverySchema.safeParse(payload)
    if (!parsed.success) {
      setError(manualDeliveryValidationMessage(parsed.error))
      return
    }
    operationId.current = parsed.data.operationId
    setPending(true)
    try {
      const result = await createManualDelivery(parsed.data)
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
    <form noValidate onSubmit={submit} className="space-y-5 rounded-xl border bg-white p-6">
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
              setBuyerMode('existing')
              setError('')
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
                setBuyerMode('existing')
                setError('')
              }}
            >
              <option value="sellerLead">Vendedor</option>
              <option value="buyerLead">Comprador</option>
            </select>
          </label>
        )}
        {kind && recipientType === 'buyerLead' && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Comprador</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="buyerMode"
                  value="existing"
                  checked={buyerMode === 'existing'}
                  onChange={() => {
                    setBuyerMode('existing')
                    setError('')
                  }}
                />
                Comprador existente
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="buyerMode"
                  value="new"
                  checked={buyerMode === 'new'}
                  onChange={() => {
                    setBuyerMode('new')
                    setError('')
                  }}
                />
                Nuevo comprador
              </label>
            </div>
          </fieldset>
        )}
        {kind && recipientType === 'buyerLead' && buyerMode === 'new' ? (
          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Datos del nuevo comprador</legend>
            <p className="text-sm text-muted-foreground">
              Al crear la entrega se guardará su ficha de comprador con estos datos.
            </p>
            <label className="block">
              Nombre completo
              <input
                name="newBuyerName"
                required
                maxLength={150}
                autoComplete="name"
                className="mt-1 w-full rounded border p-2"
                value={newBuyer.name}
                onChange={(e) => setNewBuyer({ ...newBuyer, name: e.target.value })}
              />
            </label>
            <label className="block">
              Email
              <input
                name="newBuyerEmail"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                className="mt-1 w-full rounded border p-2"
                value={newBuyer.email}
                onChange={(e) => setNewBuyer({ ...newBuyer, email: e.target.value })}
              />
            </label>
            <label className="block">
              Teléfono
              <input
                name="newBuyerPhone"
                type="tel"
                required
                maxLength={40}
                autoComplete="tel"
                className="mt-1 w-full rounded border p-2"
                value={newBuyer.phone}
                onChange={(e) => setNewBuyer({ ...newBuyer, phone: e.target.value })}
              />
            </label>
            <label className="block">
              Origen de captación
              <BuyerSourceSelect
                name="newBuyerSource"
                value={newBuyer.source}
                onChange={(source) => setNewBuyer({ ...newBuyer, source: source ?? null })}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
          </fieldset>
        ) : kind ? (
          <div className="space-y-2">
            <TargetPicker
              key={recipientType}
              type={recipientType}
              label={recipientType === 'buyerLead' ? 'Comprador' : 'Vendedor'}
              value={recipientId}
              onChange={(id) => {
                setRecipientId(id)
                setError('')
              }}
            />
            <p className="text-sm text-muted-foreground">
              Busca por nombre y selecciona un resultado. Escribir en el buscador no crea una ficha.
              {recipientType === 'buyerLead' && ' Si aún no tiene ficha, elige «Nuevo comprador».'}
            </p>
          </div>
        ) : null}
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
      {error && operationId.current && (
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
