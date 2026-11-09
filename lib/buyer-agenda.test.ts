import { describe, expect, it } from 'vitest'
import { buyerAgendaPage, type BuyerAgendaEntry } from './buyer-agenda'

function entry(eventId: string | null, day: number | null): BuyerAgendaEntry {
  return { eventId, title: 'Llamar', due: day ? new Date(Date.UTC(2026, 10, day, 12)) : null }
}

describe('agenda del comprador', () => {
  const events = [entry('a', 5), entry('b', 8), entry('c', 8), entry('d', 14)]
  it.each([
    [3, [null, 'a', 'b', 'c', 'd']],
    [5, ['a', null, 'b', 'c', 'd']],
    [8, ['a', 'b', 'c', null, 'd']],
    [12, ['a', 'b', 'c', null, 'd']],
    [null, ['a', 'b', 'c', 'd', null]],
  ] as const)('conserva todos los elementos cuando el recordatorio vence el %s', (day, ids) => {
    const reminder = entry(null, day)
    const first = buyerAgendaPage(events[0], events.slice(0, 3), reminder, 1, 2)
    const second = buyerAgendaPage(events[0], events.slice(2), reminder, 2, 2)
    expect(second.first).toEqual(first.first)
    expect([first.first, ...first.others, ...second.others].map((item) => item?.eventId)).toEqual(
      ids
    )
  })

  it('muestra el recordatorio sin fecha como única pendiente o una agenda vacía', () => {
    const reminder = entry(null, null)
    expect(buyerAgendaPage(undefined, [], reminder, 1, 2)).toEqual({ first: reminder, others: [] })
    expect(buyerAgendaPage(undefined, [], undefined, 1, 2)).toEqual({
      first: undefined,
      others: [],
    })
  })
})
