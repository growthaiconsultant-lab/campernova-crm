import { describe, expect, it } from 'vitest'
import {
  defaultNextActionForNewLead,
  formatNextActionDue,
  isNextActionOverdue,
  isValidNextActionType,
  NEXT_ACTION_LABELS,
  NEXT_ACTION_OPTIONS,
} from './next-action'

describe('defaultNextActionForNewLead', () => {
  it('devuelve LLAMAR mañana a las 10:00', () => {
    const now = new Date('2026-07-07T16:30:00')
    const { type, dueAt } = defaultNextActionForNewLead(now)
    expect(type).toBe('LLAMAR')
    expect(dueAt.getDate()).toBe(8)
    expect(dueAt.getHours()).toBe(10)
    expect(dueAt.getMinutes()).toBe(0)
  })

  it('cruza de mes correctamente', () => {
    const now = new Date('2026-07-31T09:00:00')
    const { dueAt } = defaultNextActionForNewLead(now)
    expect(dueAt.getMonth()).toBe(7) // agosto (0-indexed)
    expect(dueAt.getDate()).toBe(1)
  })
})

describe('isNextActionOverdue', () => {
  const now = new Date('2026-07-07T12:00:00')

  it('null/undefined nunca está vencida', () => {
    expect(isNextActionOverdue(null, now)).toBe(false)
    expect(isNextActionOverdue(undefined, now)).toBe(false)
  })

  it('fecha pasada está vencida', () => {
    expect(isNextActionOverdue(new Date('2026-07-07T11:59:00'), now)).toBe(true)
  })

  it('fecha futura no está vencida', () => {
    expect(isNextActionOverdue(new Date('2026-07-07T12:01:00'), now)).toBe(false)
  })
})

describe('formatNextActionDue', () => {
  const now = new Date('2026-07-07T12:00:00')

  it('hoy', () => {
    expect(formatNextActionDue(new Date('2026-07-07T17:00:00'), now)).toMatch(/^hoy /)
  })

  it('mañana', () => {
    expect(formatNextActionDue(new Date('2026-07-08T10:00:00'), now)).toMatch(/^mañana /)
  })

  it('ayer', () => {
    expect(formatNextActionDue(new Date('2026-07-06T10:00:00'), now)).toMatch(/^ayer /)
  })

  it('fecha lejana con día y mes', () => {
    expect(formatNextActionDue(new Date('2026-07-20T10:00:00'), now)).toMatch(/20 jul/)
  })
})

describe('isValidNextActionType', () => {
  it('acepta los tipos del enum', () => {
    for (const opt of NEXT_ACTION_OPTIONS) {
      expect(isValidNextActionType(opt.value)).toBe(true)
    }
  })

  it('rechaza valores desconocidos', () => {
    expect(isValidNextActionType('HACKEAR')).toBe(false)
    expect(isValidNextActionType('')).toBe(false)
  })

  it('hay 8 tipos con label', () => {
    expect(Object.keys(NEXT_ACTION_LABELS)).toHaveLength(8)
  })
})
