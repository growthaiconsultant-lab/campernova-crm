import { describe, expect, it } from 'vitest'
import { buyerActionInput, BUYER_ACTION_OPTIONS, followupPage } from './buyer-followup'
import { createCalendarEventSchema } from './validators/calendar-event'
import { resolveCommitment } from './calendar/commitment'

const input = {
  buyerLeadId: 'buyer-1',
  actorId: 'agent-1',
  action: 'LLAMAR',
  title: '',
  date: '2026-10-22',
  time: '17:30',
  notes: '  Consultar financiación  ',
  commitment: '' as const,
}

describe('COM-10 programación desde ficha', () => {
  it.each(BUYER_ACTION_OPTIONS)(
    'guarda $label con tipo, nota, hora y responsable válidos',
    (option) => {
      const event = buyerActionInput({ ...input, action: option.value, title: 'Revisar opciones' })
      expect(createCalendarEventSchema.safeParse(event).success).toBe(true)
      expect(resolveCommitment(event.type, event.commitment).ok).toBe(true)
      expect(event).toMatchObject({
        buyerLeadId: 'buyer-1',
        assignedToId: 'agent-1',
        description: 'Consultar financiación',
        specificData: { buyer_action_type: option.value },
      })
      const when = new Date(event.startAt)
      expect(when.getHours()).toBe(17)
      expect(when.getMinutes()).toBe(30)
      expect(when.getDate()).toBe(22)
    }
  )
  it('no convierte un recordatorio en compromiso externo por defecto', () => {
    expect(buyerActionInput(input).commitment).toBeNull()
    expect(buyerActionInput({ ...input, commitment: 'INTERNO' }).commitment).toBe('INTERNO')
    expect(buyerActionInput({ ...input, action: 'VISITA' }).commitment).toBe('EXTERNO')
  })
  it('rechaza fecha, hora o tipo ausentes antes de enviar', () => {
    expect(() => buyerActionInput({ ...input, date: '' })).toThrow()
    expect(() => buyerActionInput({ ...input, time: '' })).toThrow()
    expect(() => buyerActionInput({ ...input, action: 'INVENTADO' })).toThrow()
    expect(() => buyerActionInput({ ...input, action: 'OTRO' })).toThrow()
  })
  it.each(['-1', '0', '1.5', 'Infinity', '10001', 'foo'])(
    'acota paginación inválida %s',
    (value) => {
      expect(followupPage(value)).toBe(1)
    }
  )
})
