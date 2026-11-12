import { expect, it } from 'vitest'
import { madridDayRange } from './workday'

it.each([
  ['2026-03-29T12:00:00Z', '2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z'],
  ['2026-10-25T12:00:00Z', '2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z'],
  ['2026-11-12T23:15:00Z', '2026-11-12T23:00:00Z', '2026-11-13T23:00:00Z'],
])('calcula el día de Madrid de %s', (now, start, end) => {
  expect(madridDayRange(new Date(now))).toEqual({ from: new Date(start), to: new Date(end) })
})
