'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCalendarEvent } from '../actions'
import { EVENT_PRIORITY_OPTIONS, EVENT_TYPE_OPTIONS } from '@/lib/calendar/event-meta'
import type { CalendarEventType } from '@prisma/client'

type Option = { id: string; label: string }

type Props = {
  agents: Option[]
  buyers: Option[]
  vehicles: Option[]
  defaults: { type?: string; buyerLeadId?: string; vehicleId?: string; sellerLeadId?: string }
}

const APPOINTMENT_CHANNELS = [
  { value: 'in_person', label: 'Presencial' },
  { value: 'phone_call', label: 'Llamada' },
  { value: 'video_call', label: 'Videollamada' },
  { value: 'test_drive', label: 'Prueba' },
]

export function EventForm({ agents, buyers, vehicles, defaults }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [type, setType] = useState<string>(
    defaults.type && EVENT_TYPE_OPTIONS.some((o) => o.value === defaults.type)
      ? defaults.type
      : 'CITA'
  )
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [duration, setDuration] = useState('60')
  const [priority, setPriority] = useState('MEDIA')
  const [assignedToId, setAssignedToId] = useState('')
  const [buyerLeadId, setBuyerLeadId] = useState(defaults.buyerLeadId ?? '')
  const [vehicleId, setVehicleId] = useState(defaults.vehicleId ?? '')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  // Cita / Llamada
  const [channel, setChannel] = useState('in_person')
  const [phone, setPhone] = useState('')
  const [goal, setGoal] = useState('')

  const isCita = type === 'CITA'
  const isLlamada = type === 'LLAMADA'

  function submit() {
    setError(null)
    if (!title.trim()) return setError('El título es obligatorio')
    if (!date) return setError('Indica fecha y hora')

    const specificData = isCita
      ? {
          appointment_channel: channel,
          buyer_phone: phone || undefined,
          appointment_goal: goal || undefined,
        }
      : isLlamada
        ? { buyer_phone: phone || undefined, call_reason: goal || undefined }
        : undefined

    startTransition(async () => {
      const result = await createCalendarEvent({
        type: type as CalendarEventType,
        title: title.trim(),
        description: description.trim() || null,
        startAt: new Date(date).toISOString(),
        durationMinutes: duration ? parseInt(duration, 10) : null,
        priority,
        assignedToId: assignedToId || null,
        buyerLeadId: buyerLeadId || null,
        sellerLeadId: defaults.sellerLeadId || null,
        vehicleId: vehicleId || null,
        location: location.trim() || null,
        specificData,
      })
      if (result.error) setError(result.error)
      else if (result.id) router.push(`/calendario/${result.id}`)
    })
  }

  const inputCls =
    'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'
  const labelCls = 'mb-1.5 block text-[13px] font-medium text-foreground'

  return (
    <div className="space-y-5">
      {/* Tipo */}
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setType(o.value)}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
              type === o.value
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-foreground/40'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Título *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isCita ? 'Cita — ver McLouis MC4' : 'Título del evento'}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Fecha y hora *</label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Duración (min)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Prioridad</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={inputCls}
            >
              {EVENT_PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Responsable</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className={inputCls}
            >
              <option value="">Sin asignar</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Asociaciones */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Asociar
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Comprador</label>
            <select
              value={buyerLeadId}
              onChange={(e) => setBuyerLeadId(e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Vehículo</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cita-specific */}
      {isCita && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Detalles de la cita
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Canal</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className={inputCls}
              >
                {APPOINTMENT_CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Objetivo de la cita</label>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Ver distribución y revisar financiación"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      )}

      {/* Llamada-specific */}
      {isLlamada && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Detalles de la llamada
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Teléfono</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Motivo</label>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Seguimiento tras la visita"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <label className={labelCls}>Observaciones</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputCls}
        />
        <label className={`${labelCls} mt-4`}>Ubicación</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Nave Parets, videollamada…"
          className={inputCls}
        />
      </div>

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-foreground px-4 py-2 text-[13px] font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Crear evento'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
