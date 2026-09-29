import { describe, expect, it } from 'vitest'
import { deliveryCreatesSale, deliveryRecipientName, DELIVERY_KIND_LABELS } from './delivery-kind'

describe('OPS-1: lectores de entregas tipadas', () => {
  it.each(['DEVOLUCION_VENDEDOR', 'ENTREGA_TALLER'] as const)(
    '%s no representa una venta',
    (kind) => expect(deliveryCreatesSale(kind)).toBe(false)
  )
  it('sólo VENTA representa una venta', () => {
    expect(deliveryCreatesSale('VENTA')).toBe(true)
  })
  it('muestra el comprador de una venta', () => {
    expect(deliveryRecipientName({ buyerLead: { name: 'Comprador QA' } })).toBe('Comprador QA')
  })
  it('muestra el vendedor receptor sin necesitar comprador', () => {
    expect(
      deliveryRecipientName({ buyerLead: null, recipientSellerLead: { name: 'Vendedor QA' } })
    ).toBe('Vendedor QA')
  })
  it('tolera nombres ausentes sin inventar un destinatario', () => {
    expect(deliveryRecipientName({ buyerLead: null })).toBe('Sin nombre registrado')
    expect(deliveryRecipientName({ buyerLead: { name: null } })).toBe('Sin nombre registrado')
  })
  it('etiqueta de forma inequívoca los tres tipos', () => {
    expect(new Set(Object.values(DELIVERY_KIND_LABELS)).size).toBe(3)
  })
})
