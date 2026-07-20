import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Car, User as UserIcon, MapPin, Clock } from 'lucide-react'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import {
  EVENT_PRIORITY_LABELS,
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
} from '@/lib/calendar/event-meta'
import { COMMITMENT_LABELS } from '@/lib/calendar/commitment'
import { EventStatusBar } from './event-status-bar'
import { EventCommitmentCard } from './event-commitment-card'

const fmtDateTime = (d: Date) =>
  d.toLocaleString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  })

export default async function EventoDetallePage({ params }: { params: { id: string } }) {
  await requireAuth()

  const event = await db.calendarEvent.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      buyerLead: { select: { id: true, name: true } },
      sellerLead: { select: { id: true, name: true } },
      vehicle: { select: { id: true, brand: true, model: true, year: true, sellerLeadId: true } },
    },
  })
  if (!event) notFound()

  const specific = (event.specificData ?? {}) as Record<string, unknown>

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/calendario"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Calendario
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {EVENT_TYPE_LABELS[event.type]}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-foreground">
            {EVENT_STATUS_LABELS[event.status]}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              event.commitment === 'INDETERMINADO'
                ? 'bg-amber-100 text-amber-800'
                : 'border border-border text-muted-foreground'
            }`}
          >
            {COMMITMENT_LABELS[event.commitment]}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Prioridad {EVENT_PRIORITY_LABELS[event.priority].toLowerCase()}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold">{event.title}</h1>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-5 text-[13px]">
        <div className="flex items-center gap-2 text-foreground">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="first-letter:uppercase">{fmtDateTime(event.startAt)}</span>
          {event.durationMinutes && (
            <span className="text-muted-foreground">· {event.durationMinutes} min</span>
          )}
        </div>
        {event.assignedTo && (
          <div className="flex items-center gap-2 text-foreground">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            {event.assignedTo.name}
          </div>
        )}
        {event.location && (
          <div className="flex items-center gap-2 text-foreground">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {event.location}
          </div>
        )}
        {(event.buyerLead || event.sellerLead || event.vehicle) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {event.buyerLead && (
              <Link
                href={`/compradores/${event.buyerLead.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] hover:bg-muted"
              >
                <UserIcon className="h-3.5 w-3.5" />
                {event.buyerLead.name}
              </Link>
            )}
            {event.sellerLead && (
              <Link
                href={`/vendedores/${event.sellerLead.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] hover:bg-muted"
              >
                <UserIcon className="h-3.5 w-3.5" />
                {event.sellerLead.name}
              </Link>
            )}
            {event.vehicle && (
              <Link
                href={`/vendedores/${event.vehicle.sellerLeadId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] hover:bg-muted"
              >
                <Car className="h-3.5 w-3.5" />
                {event.vehicle.brand} {event.vehicle.model} ({event.vehicle.year})
              </Link>
            )}
          </div>
        )}
        {event.description && (
          <p className="whitespace-pre-wrap border-t border-border pt-3 text-muted-foreground">
            {event.description}
          </p>
        )}
        {typeof specific.appointment_goal === 'string' && specific.appointment_goal && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Objetivo:</span>{' '}
            {specific.appointment_goal}
          </p>
        )}
        {typeof specific.call_reason === 'string' && specific.call_reason && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Motivo:</span> {specific.call_reason}
          </p>
        )}
        {typeof specific.buyer_phone === 'string' && specific.buyer_phone && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Teléfono:</span> {specific.buyer_phone}
          </p>
        )}
        {event.resultNotes && (
          <p className="rounded-lg bg-green-50 p-2.5 text-green-800">
            <span className="font-medium">Resultado:</span> {event.resultNotes}
          </p>
        )}
        {event.cancellationReason && (
          <p className="rounded-lg bg-red-50 p-2.5 text-red-700">
            <span className="font-medium">Motivo:</span> {event.cancellationReason}
          </p>
        )}
      </div>

      {/* Acciones de estado */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Estado
        </p>
        <EventCommitmentCard eventId={event.id} type={event.type} commitment={event.commitment} />

        <EventStatusBar eventId={event.id} status={event.status} />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Creado por {event.createdBy.name} ·{' '}
        {event.createdAt.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Europe/Madrid',
        })}
      </p>
    </div>
  )
}
