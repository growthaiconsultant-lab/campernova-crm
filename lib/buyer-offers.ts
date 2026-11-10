import type { OfferStatus } from '@prisma/client'
import { isReservation, isTerminalOfferStatus } from './offers'

type Operation = { status: OfferStatus; depositAmount: number | null; reservedUntil: string | null }

export function groupBuyerOffers<T extends Operation>(offers: readonly T[]) {
  const reservations: T[] = []
  const open: T[] = []
  const history: T[] = []
  for (const offer of offers) {
    if (isReservation(offer.status, offer.depositAmount)) reservations.push(offer)
    else if (isTerminalOfferStatus(offer.status)) history.push(offer)
    else open.push(offer)
  }
  // The buyer page supplies ISO timestamps and newest-first order for ties.
  reservations.sort((a, b) => {
    if (a.reservedUntil === b.reservedUntil) return 0
    if (a.reservedUntil === null) return 1
    if (b.reservedUntil === null) return -1
    return Date.parse(a.reservedUntil) - Date.parse(b.reservedUntil)
  })
  return { reservations, open, history }
}

const madridDay = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const spanishDate = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
export function offerDay(date: Date) {
  return madridDay.format(date)
}
export function offerDateLabel(iso: string) {
  return spanishDate.format(new Date(iso))
}
export function reservationNotice(iso: string, today: string) {
  const day = offerDay(new Date(iso))
  if (day === today) return 'Vence hoy'
  return day < today ? 'Plazo vencido · revisar' : null
}
