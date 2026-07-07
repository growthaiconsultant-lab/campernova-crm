import { describe, expect, it } from 'vitest'
import { groupItemsByAssignee } from './reminders'
import type { CalendarItem } from './types'

function item(id: string, assigneeId: string | null, start: Date): CalendarItem {
  return {
    id,
    source: 'event',
    kindLabel: 'Cita',
    title: id,
    start,
    end: null,
    allDay: false,
    status: 'Programado',
    tone: 'default',
    href: `/calendario/${id}`,
    assigneeId,
    assigneeName: assigneeId,
    contextLabel: null,
  }
}

describe('groupItemsByAssignee', () => {
  it('agrupa por responsable y descarta los sin asignar', () => {
    const items = [
      item('a', 'u1', new Date('2026-07-10T12:00:00')),
      item('b', 'u2', new Date('2026-07-10T09:00:00')),
      item('c', 'u1', new Date('2026-07-10T08:00:00')),
      item('d', null, new Date('2026-07-10T10:00:00')),
    ]
    const g = groupItemsByAssignee(items)
    expect(g.size).toBe(2)
    expect(g.get('u1')!.map((i) => i.id)).toEqual(['c', 'a']) // ordenado por hora
    expect(g.get('u2')!.map((i) => i.id)).toEqual(['b'])
    expect(Array.from(g.keys())).not.toContain(null)
  })

  it('lista vacía → mapa vacío', () => {
    expect(groupItemsByAssignee([]).size).toBe(0)
  })
})
