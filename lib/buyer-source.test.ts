import { describe, expect, it } from 'vitest'
import { buyerSourceFilter, buyerSourceLabel, BUYER_SOURCE_VALUES } from './buyer-source'
import { createBuyerLeadSchema, updateBuyerLeadSchema } from './validators/buyer-lead'
import { manualDeliverySchema, manualDeliveryValidationMessage } from './operations-input'

const contact = { name: 'QA', email: 'qa@example.test', phone: '600111222' }
describe('COM-1 origen de captación', () => {
  it.each(BUYER_SOURCE_VALUES)(
    'acepta %s en alta, edición y comprador nuevo desde entrega',
    (source) => {
      expect(createBuyerLeadSchema.parse({ ...contact, source }).source).toBe(source)
      expect(
        updateBuyerLeadSchema.parse({ ...contact, source, status: 'NUEVO', agentId: null }).source
      ).toBe(source)
      expect(
        manualDeliverySchema.parse({
          operationId: '2af317a9-5832-4d17-92b3-623c566af843',
          vehicleId: 'qa',
          kind: 'VENTA',
          scheduledAt: '2026-10-09T10:00:00Z',
          recipient: { type: 'newBuyer', ...contact, source },
        }).recipient
      ).toMatchObject({ source })
    }
  )
  it('conserva omisión y null para compatibilidad con clientes anteriores', () => {
    expect(createBuyerLeadSchema.parse(contact)).not.toHaveProperty('source')
    expect(
      updateBuyerLeadSchema.parse({ ...contact, status: 'NUEVO', agentId: null })
    ).not.toHaveProperty('source')
    expect(createBuyerLeadSchema.parse({ ...contact, source: null }).source).toBeNull()
  })
  it.each(['plataforma-inventada', 'ui', '', { value: 'INSTAGRAM' }])(
    'rechaza source arbitrario %j',
    (source) => {
      expect(createBuyerLeadSchema.safeParse({ ...contact, source }).success).toBe(false)
      expect(
        updateBuyerLeadSchema.safeParse({ ...contact, source, status: 'NUEVO', agentId: null })
          .success
      ).toBe(false)
      const result = manualDeliverySchema.safeParse({
        operationId: '2af317a9-5832-4d17-92b3-623c566af843',
        vehicleId: 'qa',
        kind: 'VENTA',
        scheduledAt: '2026-10-09T10:00:00Z',
        recipient: { type: 'newBuyer', ...contact, source },
      })
      expect(result.success).toBe(false)
      if (!result.success)
        expect(manualDeliveryValidationMessage(result.error)).toContain(
          'origen de captación válido'
        )
    }
  )
  it('traduce plataformas y mantiene legibles los orígenes históricos', () => {
    expect(buyerSourceLabel('COCHES_NET')).toBe('Coches.net')
    expect(buyerSourceLabel('CHAT_WEB')).toBe('Chat web')
    expect(buyerSourceLabel(null)).toBe('Sin especificar')
    expect(buyerSourceLabel('REFERIDO_ANTIGUO')).toBe('REFERIDO_ANTIGUO')
  })
  it('filtra plataformas y conserva chat legacy en el agregado web', () => {
    expect(buyerSourceFilter('WEB')).toEqual({ source: { in: ['WEB', 'PRO', 'CHAT', 'CHAT_WEB'] } })
    expect(buyerSourceFilter('CHAT')).toEqual({ source: { in: ['CHAT', 'CHAT_WEB'] } })
    expect(buyerSourceFilter('INSTAGRAM')).toEqual({ source: 'INSTAGRAM' })
    expect(buyerSourceFilter('__none__')).toEqual({ source: null })
  })
})
