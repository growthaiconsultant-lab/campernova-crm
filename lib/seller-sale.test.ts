import { expect, it } from 'vitest'
import { sellerSale } from './seller-sale'
import { listingChange } from './portal-listings'

const offer = {
  id: 'o1',
  buyerId: 'b',
  counterpartLabel: 'Comprador',
  amount: 48000.35,
  depositAmount: 1000.25,
  reservedUntil: '2026-07-10T12:00:00Z',
  createdAt: '2026-07-01T12:00:00Z',
  status: 'ACEPTADA' as const,
}
const match = {
  status: 'VISITA' as const,
  updatedAt: new Date(),
  buyerLead: { id: 'b', name: 'Comprador' },
}
it('conserva la reserva y deduplica a una persona con visita, oferta y reserva', () => {
  const view = sellerSale(
    [offer, { ...offer, id: 'o2', status: 'CONTRAOFERTA' }],
    [match, { ...match, buyerLead: { id: 'otro', name: null } }]
  )
  expect(view.reservation).toEqual(offer)
  expect(view.interested.map((p) => p.signal)).toEqual(['Reserva con señal', 'Visita registrada'])
  expect(sellerSale([offer], []).interested[0].offerId).toBe('o1')
})
it('separa sugerencias, vehículos propuestos e historial de interés activo', () => {
  const view = sellerSale(
    [{ ...offer, status: 'RETIRADA' }],
    ['OFERTA', 'SUGERIDO', 'PROPUESTO_CLIENTE', 'CERRADO', 'RECHAZADO'].map((status) => ({
      ...match,
      status: status as typeof match.status,
    }))
  )
  expect(view).toEqual({ offer: undefined, reservation: undefined, interested: [] })
  expect(sellerSale([{ ...offer, depositAmount: null }], []).interested[0].signal).toBe(
    'Oferta aceptada sin señal'
  )
})
const valid = {
  action: 'publish',
  channel: 'WALLAPOP',
  revision: 0,
  url: 'https://es.wallapop.com/item/camper-123',
  publishedOn: '2025-11-04',
}
it('valida canal, dominio, protocolo y fecha real', () => {
  expect(listingChange.safeParse(valid).success).toBe(true)
  for (const changes of [
    { url: 'https://wallapop.com.ejemplo.test/x' },
    { url: 'https://coches.net/x' },
    { url: 'http://wallapop.com/item/x' },
    { url: 'https://user:pass@wallapop.com/item/x' },
    { publishedOn: '2025-02-30' },
    { publishedOn: '2099-01-01' },
    { channel: 'OTRO' },
  ])
    expect(listingChange.safeParse({ ...valid, ...changes }).success).toBe(false)
})
