import { describe, expect, it } from 'vitest'
import type { OfferStatus } from '@prisma/client'
import { groupBuyerOffers, offerDay, reservationNotice } from './buyer-offers'
import { formatEur } from './format/currency'

const make = (
  status: OfferStatus,
  depositAmount: number | null,
  reservedUntil: string | null = null
) => ({ status, depositAmount, reservedUntil })
describe('operaciones del comprador', () => {
  it('conserva cada operación e importe, ordena por plazo y mantiene los estados anteriores', () => {
    const old = make('ACEPTADA', 100.25, '2025-12-01T00:00:00Z'),
      future = make('ACEPTADA', 100, '2028-01-01T00:00:00Z'),
      undated = make('ACEPTADA', 0.01)
    const open = [
      make('ACEPTADA', 0),
      make('ACEPTADA', null, '2026-01-01T00:00:00Z'),
      make('CONTRAOFERTA', null),
      make('PROPUESTA', null),
    ]
    const history = (['CANCELADA', 'CONVERTIDA', 'EXPIRADA', 'RETIRADA', 'RECHAZADA'] as const).map(
      (s) => make(s, 200, '2026-03-02T00:00:00Z')
    )
    expect(groupBuyerOffers(Object.freeze([undated, ...open, future, ...history, old]))).toEqual({
      reservations: [old, future, undated],
      open,
      history,
    })
    expect(formatEur(0.01, 'cents')).toBe('0,01\u00a0€')
    expect(formatEur(42750.5, 'cents')).toBe('42.750,50\u00a0€')
  })
  it('cuenta días de Madrid incluso junto al cambio de hora', () => {
    const sunset = '2026-10-24T22:30:00Z'
    expect(offerDay(new Date(sunset))).toBe('2026-10-25')
    expect(reservationNotice(sunset, '2026-10-25')).toBe('Vence hoy')
    expect(reservationNotice(sunset, '2026-10-26')).toBe('Plazo vencido · revisar')
    expect(reservationNotice(sunset, '2026-10-24')).toBeNull()
  })
})
