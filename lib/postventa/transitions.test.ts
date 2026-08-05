import { describe, expect, it } from 'vitest'
import {
  isTerminalTicketStatus,
  isTicketTransitionAllowed,
  TICKET_CORRECTION_TARGET,
  TICKET_REOPEN_TARGET,
} from './transitions'

describe('post-sales ticket transition policy', () => {
  it('separa avance, corrección y reapertura', () => {
    expect(isTicketTransitionAllowed('ABIERTO', 'EN_PROGRESO', 'forward')).toBe(true)
    expect(isTicketTransitionAllowed('RESUELTO', 'EN_PROGRESO', 'correction')).toBe(true)
    expect(isTicketTransitionAllowed('CERRADO', 'RESUELTO', 'reopen')).toBe(true)
    expect(isTicketTransitionAllowed('CERRADO', 'RESUELTO', 'correction')).toBe(false)
  })

  it('mantiene destinos explícitos y únicos', () => {
    expect(TICKET_CORRECTION_TARGET).toEqual({
      EN_PROGRESO: 'ABIERTO',
      RESUELTO: 'EN_PROGRESO',
    })
    expect(TICKET_REOPEN_TARGET).toEqual({ CERRADO: 'RESUELTO', ANULADO: 'ABIERTO' })
  })

  it('considera terminales cerrado y anulado', () => {
    expect(isTerminalTicketStatus('CERRADO')).toBe(true)
    expect(isTerminalTicketStatus('ANULADO')).toBe(true)
    expect(isTerminalTicketStatus('RESUELTO')).toBe(false)
  })
})
