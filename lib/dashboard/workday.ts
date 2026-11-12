import type { CaptureStatus, Prisma } from '@prisma/client'
import { offerDay, reservationNotice } from '../buyer-offers'
import { captureAnchorId, PORTAL_LABELS } from '../captacion'
import { deliveryToItem, workOrderToItem } from '../calendar/aggregate'
import { prismaCalendarDeps } from '../calendar/prisma-deps'
import { EVENT_TYPE_LABELS } from '../calendar/event-meta'
import { personLabel, vehicleLabel } from '../display'
import { NEXT_ACTION_LABELS } from '../next-action'
import { admittedSellerWhere } from '../seller-intake'
import { BUYER_LEAD_ACTIVE_STATUSES } from '../state-machine'
import { inspectionTasks } from './inspection-tasks'

const clock = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const shortDate = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: 'numeric',
  month: 'short',
})
export function madridDayRange(now: Date) {
  const midnight = Date.parse(offerDay(now) + 'T00:00:00Z')
  // At 00:00 UTC Madrid is one or two hours ahead. Resolve each boundary
  // independently because the offset can change during the day.
  function localMidnight(utc: number) {
    const hoursAhead = Number(clock.format(utc).split(':')[0])
    return new Date(utc - hoursAhead * 3600000)
  }
  return { from: localMidnight(midnight), to: localMidnight(midnight + 86400000) }
}

export type DayRow = {
  href: string
  title: string
  context: string
  owner: string | null
  when: Date | null
  label: string
}

function captureTask(
  c: {
    assignedTo: { name: string } | null
    status: CaptureStatus
    phone: string | null
    listingUrl: string | null
  },
  entry: Date | null
) {
  if (!c.assignedTo) return 'Asignar captación'
  if (entry) return 'Revisar entrada pendiente'
  if (c.status === 'NO_CONTACTADO')
    return c.phone || c.listingUrl ? 'Contactar con el vendedor' : 'Añadir teléfono de contacto'
  return c.status === 'CONTACTADO' ? 'Iniciar seguimiento' : 'Agendar entrada'
}

export async function getWorkday(
  db: Prisma.TransactionClient,
  ownerId: string | undefined,
  now: Date
) {
  const { from, to } = madridDayRange(now)
  const calendar = prismaCalendarDeps(db)
  const name = { select: { name: true } } as const
  const reminders = {
    agentId: ownerId,
    archivedAt: null,
    nextActionType: { not: null },
    OR: [{ nextActionDueAt: { lt: to } }, { nextActionDueAt: null }],
  }
  const reminderFields = {
    id: true,
    name: true,
    nextActionType: true,
    nextActionDueAt: true,
    agent: name,
  } as const
  const [
    buyers,
    sellers,
    events,
    reservations,
    captures,
    deliveries,
    orders,
    afterSales,
    inspections,
  ] = await Promise.all([
    db.buyerLead.findMany({
      where: { ...reminders, mergedIntoId: null, status: { in: BUYER_LEAD_ACTIVE_STATUSES } },
      select: reminderFields,
    }),
    db.sellerLead.findMany({
      where: {
        ...reminders,
        ...admittedSellerWhere,
        status: { notIn: ['CERRADO', 'DESCARTADO'] },
      },
      select: reminderFields,
    }),
    db.calendarEvent.findMany({
      where: {
        assignedToId: ownerId,
        status: { in: ['PROGRAMADO', 'CONFIRMADO', 'EN_CURSO'] },
        startAt: { lt: to },
        OR: [
          { startAt: { gte: from } },
          { type: { in: ['LLAMADA', 'SEGUIMIENTO'] } },
          { commitment: 'INTERNO' },
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        commitment: true,
        allDay: true,
        startAt: true,
        assignedTo: name,
        buyerLead: name,
        sellerLead: name,
        vehicle: { select: { brand: true, model: true, year: true } },
      },
    }),
    db.offer.findMany({
      where: {
        status: 'ACEPTADA',
        depositAmount: { gt: 0 },
        buyerLead: { agentId: ownerId },
        OR: [{ reservedUntil: { lt: to } }, { reservedUntil: null }],
      },
      select: {
        id: true,
        buyerLeadId: true,
        reservedUntil: true,
        buyerLead: { select: { name: true, agent: name } },
        vehicle: { select: { brand: true, model: true, year: true } },
      },
    }),
    db.vehicleCapture.findMany({
      where: {
        assignedToId: ownerId,
        sellerLeadId: null,
        status: { notIn: ['CONVERTIDO', 'RECHAZADO'] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        portal: true,
        entradaScheduledAt: true,
        assignedTo: name,
        phone: true,
        listingUrl: true,
      },
    }),
    calendar.listDeliveries(from, to, ownerId),
    calendar.listWorkOrders(from, to, ownerId),
    ownerId ? [] : calendar.listFollowups(from, to),
    inspectionTasks(db, ownerId),
  ])
  const tasks: DayRow[] = []
  const agenda: DayRow[] = []
  function due(date: Date | null, allDay = false) {
    if (!date) return 'Sin fecha'
    if (date < from) return 'Vencida · ' + shortDate.format(date)
    if (allDay) return 'Hoy · sin hora'
    return (date < now ? 'Vencida · ' : 'Hoy · ') + clock.format(date)
  }
  function addReminders(rows: typeof sellers, kind: 'Comprador' | 'Vendedor') {
    for (const row of rows) {
      if (!row.nextActionType) continue
      tasks.push({
        title: NEXT_ACTION_LABELS[row.nextActionType],
        context:
          kind + ' · ' + personLabel(row.name, { role: kind + ' sin identificar', id: row.id }),
        owner: row.agent?.name ?? null,
        when: row.nextActionDueAt,
        label: due(row.nextActionDueAt),
        href:
          kind === 'Comprador'
            ? '/compradores/' + row.id + '?tab=ficha#seguimiento'
            : '/vendedores/' + row.id + '?tab=resumen#seller-next',
      })
    }
  }
  addReminders(buyers, 'Comprador')
  addReminders(sellers, 'Vendedor')
  for (const e of events) {
    const action = e.type === 'LLAMADA' || e.type === 'SEGUIMIENTO' || e.commitment === 'INTERNO'
    const todo = e.startAt < from || (action && (e.allDay || e.startAt < now))
    const row = {
      title: e.title,
      context: [
        EVENT_TYPE_LABELS[e.type],
        e.buyerLead?.name ?? e.sellerLead?.name ?? (e.vehicle ? vehicleLabel(e.vehicle) : null),
      ]
        .filter(Boolean)
        .join(' · '),
      href: '/calendario/' + e.id,
      owner: e.assignedTo?.name ?? null,
      when: e.startAt,
      label: todo ? due(e.startAt, e.allDay) : e.allDay ? 'Todo el día' : clock.format(e.startAt),
    }
    if (todo) tasks.push(row)
    else agenda.push(row)
  }
  for (const r of reservations) {
    const notice =
      r.reservedUntil && reservationNotice(r.reservedUntil.toISOString(), offerDay(now))
    tasks.push({
      title: r.reservedUntil
        ? notice === 'Vence hoy'
          ? 'Confirmar continuidad de la reserva'
          : 'Revisar reserva vencida'
        : 'Acordar el plazo de reserva',
      context: r.buyerLead.name + ' · ' + vehicleLabel(r.vehicle),
      owner: r.buyerLead.agent?.name ?? null,
      href: '/compradores/' + r.buyerLeadId + '?tab=vehiculos#oferta-' + r.id,
      when: r.reservedUntil,
      label: r.reservedUntil
        ? notice === 'Vence hoy'
          ? 'Vence hoy'
          : 'Plazo vencido · ' + shortDate.format(r.reservedUntil)
        : 'Sin plazo',
    })
  }
  for (const c of captures) {
    const entry = c.status === 'ENTRADA_AGENDADA' ? c.entradaScheduledAt : null
    const row = {
      context: (c.title || 'Vehículo sin identificar') + ' · ' + PORTAL_LABELS[c.portal],
      owner: c.assignedTo?.name ?? null,
      href: '/captaciones?focus=' + c.id + '#' + captureAnchorId(c.id),
      when: entry,
    }
    if (entry && entry >= from && entry < to) {
      agenda.push({ ...row, title: 'Entrada de vehículo', label: clock.format(entry) })
    } else if (!entry || entry < from || !c.assignedTo) {
      tasks.push({
        ...row,
        title: captureTask(c, entry),
        label: entry && entry < from ? due(entry) : 'Captación',
      })
    }
  }
  for (const item of [
    ...deliveries
      .filter((d) => d.status === 'PROGRAMADA' || d.status === 'EN_CURSO')
      .map(deliveryToItem),
    ...orders
      .filter((o) => o.status !== 'COMPLETADA' && o.status !== 'RECHAZADA')
      .map(workOrderToItem),
  ]) {
    agenda.push({
      title: item.title,
      href: item.href,
      context: item.contextLabel ?? '',
      owner: item.assigneeName,
      when: item.start,
      label: item.start < from ? 'En curso' : clock.format(item.start),
    })
  }
  for (const f of afterSales.filter((f) => f.status === 'PENDIENTE' || f.status === 'FALLIDO')) {
    tasks.push({
      title: 'Seguimiento de postventa',
      context: f.type === 'DIA_7' ? 'Día 7' : 'Día 30',
      href: '/postventa/' + f.warrantyId,
      owner: null,
      when: f.scheduledFor,
      label: 'Hoy',
    })
  }
  function chronological(a: DayRow, b: DayRow) {
    return (
      (a.when?.getTime() ?? Infinity) - (b.when?.getTime() ?? Infinity) ||
      a.title.localeCompare(b.title, 'es') ||
      a.href.localeCompare(b.href)
    )
  }
  tasks.sort(chronological)
  agenda.sort(chronological)
  return { tasks: [...inspections, ...tasks], agenda }
}
