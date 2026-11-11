import type { MatchStatus, OfferStatus } from '@prisma/client'
import { groupBuyerOffers } from './buyer-offers'
import { OFFER_STATUS_LABELS } from './offers'
import { personLabel } from './display'

type SaleOffer = {
  id: string
  buyerId: string
  counterpartLabel: string
  status: OfferStatus
  depositAmount: number | null
  reservedUntil: string | null
  createdAt: string
  amount: number
}
type SaleMatch = {
  status: MatchStatus
  updatedAt: Date
  buyerLead: { id: string; name: string | null }
}
type Interest = { buyerId: string; name: string; signal: string; offerId?: string }
export function sellerSale(offers: SaleOffer[], matches: SaleMatch[]) {
  const { reservations, open, history } = groupBuyerOffers(offers)
  const interested = new Map<string, Interest>()
  for (const offer of reservations) {
    if (!interested.has(offer.buyerId))
      interested.set(offer.buyerId, {
        buyerId: offer.buyerId,
        name: offer.counterpartLabel,
        signal: 'Reserva con señal',
        offerId: offer.id,
      })
  }
  for (const offer of open) {
    if (!interested.has(offer.buyerId))
      interested.set(offer.buyerId, {
        buyerId: offer.buyerId,
        name: offer.counterpartLabel,
        signal:
          offer.status === 'ACEPTADA'
            ? 'Oferta aceptada sin señal'
            : OFFER_STATUS_LABELS[offer.status],
        offerId: offer.id,
      })
  }
  const pastOffers = new Set(history.map((o) => o.buyerId))
  const contacts = matches
    .filter((m) => m.status === 'VISITA' || m.status === 'OFERTA')
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  for (const m of contacts) {
    const buyerId = m.buyerLead.id
    if (interested.has(buyerId) || (m.status === 'OFERTA' && pastOffers.has(buyerId))) continue
    interested.set(buyerId, {
      buyerId,
      name: personLabel(m.buyerLead.name, { role: 'Comprador sin identificar', id: buyerId }),
      signal: m.status === 'VISITA' ? 'Visita registrada' : 'Oferta indicada en el seguimiento',
    })
  }
  return {
    reservation: reservations[0],
    offer: open[0],
    interested: Array.from(interested.values()),
  }
}
