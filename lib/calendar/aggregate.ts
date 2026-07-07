import { NEXT_ACTION_LABELS } from '../next-action'
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS } from './event-meta'
import type { CalendarEventStatus, CalendarEventType, NextActionType } from '@prisma/client'
import type { CalendarFilters, CalendarItem, CalendarTone } from './types'

/**
 * Filas mínimas que cada origen aporta (subconjunto de las queries Prisma).
 * Mantener el shape aquí permite testear los mappers sin base de datos.
 */
export type DeliveryRow = {
  id: string
  scheduledAt: Date
  status: 'PROGRAMADA' | 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA'
  vehicle: { brand: string; model: string } | null
  buyerLead: { name: string } | null
  responsable: { id: string; name: string } | null
}

export type WorkOrderRow = {
  id: string
  scheduledStart: Date
  scheduledEnd: Date | null
  status: string
  kind: 'REPARACION' | 'MEJORA'
  description: string
  vehicle: { brand: string; model: string } | null
  assignedTo: { id: string; name: string } | null
}

export type FollowupRow = {
  id: string
  scheduledFor: Date
  type: 'DIA_7' | 'DIA_30'
  status: 'PENDIENTE' | 'ENVIADO' | 'RESPONDIDO' | 'FALLIDO'
  warrantyId: string
}

export type NextActionRow = {
  id: string
  leadKind: 'seller' | 'buyer'
  name: string
  nextActionType: NextActionType
  nextActionDueAt: Date
  agent: { id: string; name: string } | null
}

export type EventRow = {
  id: string
  type: CalendarEventType
  title: string
  status: CalendarEventStatus
  startAt: Date
  endAt: Date | null
  allDay: boolean
  assignedTo: { id: string; name: string } | null
  buyerLead: { name: string } | null
  sellerLead: { name: string } | null
  vehicle: { brand: string; model: string } | null
}

export type CalendarDeps = {
  listDeliveries: (from: Date, to: Date) => Promise<DeliveryRow[]>
  listWorkOrders: (from: Date, to: Date) => Promise<WorkOrderRow[]>
  listFollowups: (from: Date, to: Date) => Promise<FollowupRow[]>
  listNextActions: (from: Date, to: Date) => Promise<NextActionRow[]>
  listEvents: (from: Date, to: Date) => Promise<EventRow[]>
}

// ── Mappers puros ─────────────────────────────────────────────────────────────

const DELIVERY_TONE: Record<DeliveryRow['status'], CalendarTone> = {
  PROGRAMADA: 'default',
  EN_CURSO: 'warn',
  COMPLETADA: 'success',
  CANCELADA: 'muted',
}
const DELIVERY_LABEL: Record<DeliveryRow['status'], string> = {
  PROGRAMADA: 'Programada',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
}

export function deliveryToItem(r: DeliveryRow): CalendarItem {
  const veh = r.vehicle ? `${r.vehicle.brand} ${r.vehicle.model}` : 'Vehículo'
  return {
    id: `delivery:${r.id}`,
    source: 'delivery',
    kindLabel: 'Entrega',
    title: `Entrega · ${veh}`,
    start: r.scheduledAt,
    end: null,
    allDay: false,
    status: DELIVERY_LABEL[r.status],
    tone: DELIVERY_TONE[r.status],
    href: `/entregas/${r.id}`,
    assigneeName: r.responsable?.name ?? null,
    contextLabel: r.buyerLead?.name ?? null,
  }
}

const WORKORDER_TONE: Record<string, CalendarTone> = {
  PENDIENTE: 'default',
  EN_DIAGNOSTICO: 'default',
  PRESUPUESTADA: 'warn',
  EN_CURSO: 'warn',
  COMPLETADA: 'success',
  RECHAZADA: 'muted',
}

export function workOrderToItem(r: WorkOrderRow): CalendarItem {
  const veh = r.vehicle ? `${r.vehicle.brand} ${r.vehicle.model}` : 'Vehículo'
  return {
    id: `workorder:${r.id}`,
    source: 'workorder',
    kindLabel: r.kind === 'MEJORA' ? 'Taller · Mejora' : 'Taller · Reparación',
    title: `${veh} · ${r.description}`,
    start: r.scheduledStart,
    end: r.scheduledEnd,
    allDay: false,
    status: r.status,
    tone: WORKORDER_TONE[r.status] ?? 'default',
    href: `/taller/${r.id}`,
    assigneeName: r.assignedTo?.name ?? null,
    contextLabel: veh,
  }
}

const FOLLOWUP_TONE: Record<FollowupRow['status'], CalendarTone> = {
  PENDIENTE: 'default',
  ENVIADO: 'success',
  RESPONDIDO: 'success',
  FALLIDO: 'danger',
}

export function followupToItem(r: FollowupRow): CalendarItem {
  const dia = r.type === 'DIA_7' ? 'día 7' : 'día 30'
  return {
    id: `followup:${r.id}`,
    source: 'followup',
    kindLabel: 'Postventa',
    title: `Seguimiento postventa (${dia})`,
    start: r.scheduledFor,
    end: null,
    allDay: true,
    status: r.status,
    tone: FOLLOWUP_TONE[r.status],
    href: `/postventa/${r.warrantyId}`,
    assigneeName: null,
    contextLabel: null,
  }
}

export function nextActionToItem(r: NextActionRow, now: Date = new Date()): CalendarItem {
  const overdue = r.nextActionDueAt.getTime() < now.getTime()
  const base = r.leadKind === 'seller' ? '/vendedores' : '/compradores'
  return {
    id: `next_action:${r.leadKind}:${r.id}`,
    source: 'next_action',
    kindLabel: 'Próxima acción',
    title: `${NEXT_ACTION_LABELS[r.nextActionType]} · ${r.name}`,
    start: r.nextActionDueAt,
    end: null,
    allDay: false,
    status: overdue ? 'Vencida' : 'Pendiente',
    tone: overdue ? 'danger' : 'default',
    href: `${base}/${r.id}`,
    assigneeName: r.agent?.name ?? null,
    contextLabel: r.leadKind === 'seller' ? 'Vendedor' : 'Comprador',
  }
}

const EVENT_TONE: Record<CalendarEventStatus, CalendarTone> = {
  PROGRAMADO: 'default',
  CONFIRMADO: 'default',
  EN_CURSO: 'warn',
  COMPLETADO: 'success',
  CANCELADO: 'muted',
  NO_SHOW: 'danger',
}

export function eventToItem(r: EventRow): CalendarItem {
  const context =
    r.buyerLead?.name ??
    r.sellerLead?.name ??
    (r.vehicle ? `${r.vehicle.brand} ${r.vehicle.model}` : null)
  return {
    id: `event:${r.id}`,
    source: 'event',
    kindLabel: EVENT_TYPE_LABELS[r.type],
    title: r.title,
    start: r.startAt,
    end: r.endAt,
    allDay: r.allDay,
    status: EVENT_STATUS_LABELS[r.status],
    tone: EVENT_TONE[r.status],
    href: `/calendario/${r.id}`,
    assigneeName: r.assignedTo?.name ?? null,
    contextLabel: context,
  }
}

// ── Agregación ────────────────────────────────────────────────────────────────

/**
 * Reúne los ítems de todos los orígenes dentro del rango [from, to), aplica
 * filtros y los ordena por fecha de inicio ascendente.
 */
export async function getCalendarItems(
  deps: CalendarDeps,
  range: { from: Date; to: Date },
  filters: CalendarFilters = {},
  now: Date = new Date()
): Promise<CalendarItem[]> {
  const [deliveries, workOrders, followups, nextActions, events] = await Promise.all([
    deps.listDeliveries(range.from, range.to),
    deps.listWorkOrders(range.from, range.to),
    deps.listFollowups(range.from, range.to),
    deps.listNextActions(range.from, range.to),
    deps.listEvents(range.from, range.to),
  ])

  const items: CalendarItem[] = [
    ...deliveries.map(deliveryToItem),
    ...workOrders.map(workOrderToItem),
    ...followups.map(followupToItem),
    ...nextActions.map((r) => nextActionToItem(r, now)),
    ...events.map(eventToItem),
  ]

  const filtered = applyFilters(items, filters, {
    deliveries,
    workOrders,
    nextActions,
    events,
  })

  return filtered.sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Filtro por origen y responsable. Separado para poder testearlo. */
export function applyFilters(
  items: CalendarItem[],
  filters: CalendarFilters,
  raw: {
    deliveries: DeliveryRow[]
    workOrders: WorkOrderRow[]
    nextActions: NextActionRow[]
    events?: EventRow[]
  }
): CalendarItem[] {
  let out = items

  if (filters.sources && filters.sources.length > 0) {
    const set = new Set(filters.sources)
    out = out.filter((i) => set.has(i.source))
  }

  if (filters.assigneeId) {
    const id = filters.assigneeId
    // Mapa itemId → responsableId (solo orígenes con responsable)
    const assignee = new Map<string, string | null>()
    for (const d of raw.deliveries) assignee.set(`delivery:${d.id}`, d.responsable?.id ?? null)
    for (const w of raw.workOrders) assignee.set(`workorder:${w.id}`, w.assignedTo?.id ?? null)
    for (const n of raw.nextActions)
      assignee.set(`next_action:${n.leadKind}:${n.id}`, n.agent?.id ?? null)
    for (const e of raw.events ?? []) assignee.set(`event:${e.id}`, e.assignedTo?.id ?? null)
    out = out.filter((i) => assignee.get(i.id) === id)
  }

  return out
}
