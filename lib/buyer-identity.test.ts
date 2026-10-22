import { describe, expect, it } from 'vitest'
import { buyerContactHashes } from './buyer-identity'
import { firstBuyerHandler, isUnattendedAutomaticSuggestion } from './buyer-merge'

describe('automatic suggestion merge policy', () => {
  const suggestion = {
    status: 'SUGERIDO',
    generatedBy: 'auto',
    _count: { calendarEvents: 0, offers: 0 },
  }
  it('allows only automatic suggestions without subsequent decisions', () => {
    expect(isUnattendedAutomaticSuggestion(suggestion)).toBe(true)
    for (const status of ['PROPUESTO_CLIENTE', 'VISITA', 'OFERTA', 'CERRADO', 'RECHAZADO'])
      expect(isUnattendedAutomaticSuggestion({ ...suggestion, status })).toBe(false)
    expect(isUnattendedAutomaticSuggestion({ ...suggestion, generatedBy: 'manual' })).toBe(false)
    expect(
      isUnattendedAutomaticSuggestion({ ...suggestion, _count: { calendarEvents: 1, offers: 0 } })
    ).toBe(false)
    expect(
      isUnattendedAutomaticSuggestion({ ...suggestion, _count: { calendarEvents: 0, offers: 1 } })
    ).toBe(false)
  })
})

describe('buyer contact identity', () => {
  it('normalizes contact aliases without retaining plain contacts in index keys', () => {
    expect(buyerContactHashes({ phone: '612 345 678', email: ' Example@example.com ' })).toEqual(
      buyerContactHashes({ phone: '0034612345678', email: 'example@example.com' })
    )
    expect(buyerContactHashes({ phone: '612345678' })[0]).toMatch(/^[a-f0-9]{64}$/)
  })
  it('ignores missing or placeholder phone identities', () => {
    expect(buyerContactHashes({ phone: '123', email: null })).toEqual([])
  })
})

describe('first recorded buyer attention', () => {
  it('ignores automatic assignment and system entries', () => {
    const events = [
      {
        id: 'a',
        type: 'NOTA',
        content: 'COM-9: asignación automática inicial',
        agentId: 'assigned',
        createdAt: new Date(0),
      },
      {
        id: 'b',
        type: 'NOTA',
        content: 'Formulario recibido',
        agentId: null,
        createdAt: new Date(1),
      },
      {
        id: 'c',
        type: 'WHATSAPP_INICIADO',
        content: 'Atención',
        agentId: 'first',
        createdAt: new Date(2),
      },
      {
        id: 'd',
        type: 'LLAMADA',
        content: 'Atención posterior',
        agentId: 'later',
        createdAt: new Date(3),
      },
    ] as Parameters<typeof firstBuyerHandler>[0]
    expect(firstBuyerHandler(events)?.agentId).toBe('first')
  })
  it('returns no invented attention when there are only assignment entries', () => {
    expect(
      firstBuyerHandler([
        {
          id: 'a',
          type: 'LEAD_ASIGNADO',
          content: 'Asignado',
          agentId: 'assigned',
          createdAt: new Date(0),
        },
      ])
    ).toBeNull()
  })
})
