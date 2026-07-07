import { describe, expect, it } from 'vitest'
import {
  applyFilters,
  deliveryToItem,
  eventToItem,
  followupToItem,
  getCalendarItems,
  nextActionToItem,
  workOrderToItem,
  type CalendarDeps,
  type DeliveryRow,
  type EventRow,
  type FollowupRow,
  type NextActionRow,
  type WorkOrderRow,
} from './aggregate'

const delivery: DeliveryRow = {
  id: 'd1',
  scheduledAt: new Date('2026-07-10T17:00:00'),
  status: 'PROGRAMADA',
  vehicle: { brand: 'Benimar', model: 'Tessoro' },
  buyerLead: { name: 'Juan Pérez' },
  responsable: { id: 'u1', name: 'Javi' },
}

const workOrder: WorkOrderRow = {
  id: 'w1',
  scheduledStart: new Date('2026-07-08T09:00:00'),
  scheduledEnd: new Date('2026-07-09T18:00:00'),
  status: 'EN_CURSO',
  description: 'Revisar inversor',
  vehicle: { brand: 'VW', model: 'California' },
  assignedTo: { id: 'u2', name: 'Manolo' },
}

const followup: FollowupRow = {
  id: 'f1',
  scheduledFor: new Date('2026-07-12T09:00:00'),
  type: 'DIA_7',
  status: 'PENDIENTE',
  warrantyId: 'war1',
}

const nextAction: NextActionRow = {
  id: 'b1',
  leadKind: 'buyer',
  name: 'Ana',
  nextActionType: 'LLAMAR',
  nextActionDueAt: new Date('2026-07-11T10:00:00'),
  agent: { id: 'u1', name: 'Desirée' },
}

const event: EventRow = {
  id: 'e1',
  type: 'CITA',
  title: 'Cita — ver McLouis',
  status: 'CONFIRMADO',
  startAt: new Date('2026-07-09T18:00:00'),
  endAt: null,
  allDay: false,
  assignedTo: { id: 'u1', name: 'Desirée' },
  buyerLead: { name: 'Carlos' },
  sellerLead: null,
  vehicle: { brand: 'McLouis', model: 'MC4' },
}

describe('mappers', () => {
  it('event → item con href a /calendario/:id y contexto de comprador', () => {
    const it_ = eventToItem(event)
    expect(it_.id).toBe('event:e1')
    expect(it_.source).toBe('event')
    expect(it_.href).toBe('/calendario/e1')
    expect(it_.kindLabel).toBe('Cita')
    expect(it_.contextLabel).toBe('Carlos')
  })

  it('delivery → item con href e info de cliente', () => {
    const it_ = deliveryToItem(delivery)
    expect(it_.id).toBe('delivery:d1')
    expect(it_.source).toBe('delivery')
    expect(it_.href).toBe('/entregas/d1')
    expect(it_.contextLabel).toBe('Juan Pérez')
    expect(it_.title).toContain('Benimar Tessoro')
  })

  it('workOrder → item con fin y responsable', () => {
    const it_ = workOrderToItem(workOrder)
    expect(it_.id).toBe('workorder:w1')
    expect(it_.end).toEqual(workOrder.scheduledEnd)
    expect(it_.assigneeName).toBe('Manolo')
    expect(it_.href).toBe('/taller/w1')
  })

  it('followup → all-day, href a la garantía', () => {
    const it_ = followupToItem(followup)
    expect(it_.allDay).toBe(true)
    expect(it_.href).toBe('/postventa/war1')
    expect(it_.kindLabel).toBe('Postventa')
  })

  it('nextAction vencida → tono danger', () => {
    const past = nextActionToItem(nextAction, new Date('2026-07-12T00:00:00'))
    expect(past.tone).toBe('danger')
    expect(past.status).toBe('Vencida')
    expect(past.href).toBe('/compradores/b1')
  })

  it('nextAction futura → tono default', () => {
    const future = nextActionToItem(nextAction, new Date('2026-07-10T00:00:00'))
    expect(future.tone).toBe('default')
    expect(future.status).toBe('Pendiente')
  })
})

describe('getCalendarItems', () => {
  const deps: CalendarDeps = {
    listDeliveries: async () => [delivery],
    listWorkOrders: async () => [workOrder],
    listFollowups: async () => [followup],
    listNextActions: async () => [nextAction],
    listEvents: async () => [event],
  }
  const range = { from: new Date('2026-07-06'), to: new Date('2026-07-13') }

  it('reúne los 5 orígenes y ordena por fecha ascendente', async () => {
    const items = await getCalendarItems(deps, range, {}, new Date('2026-07-07'))
    expect(items).toHaveLength(5)
    const starts = items.map((i) => i.start.getTime())
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
    // El primero es la orden de taller (08-jul)
    expect(items[0].source).toBe('workorder')
  })

  it('filtra por origen', async () => {
    const items = await getCalendarItems(deps, range, { sources: ['delivery'] })
    expect(items).toHaveLength(1)
    expect(items[0].source).toBe('delivery')
  })
})

describe('applyFilters — responsable', () => {
  const items = [deliveryToItem(delivery), workOrderToItem(workOrder), nextActionToItem(nextAction)]
  const raw = { deliveries: [delivery], workOrders: [workOrder], nextActions: [nextAction] }

  it('filtra por responsable (u1 = Javi + Desirée)', () => {
    const out = applyFilters(items, { assigneeId: 'u1' }, raw)
    // delivery(u1) + nextAction(u1) → 2; workOrder es u2 → fuera
    expect(out.map((i) => i.source).sort()).toEqual(['delivery', 'next_action'])
  })
})
