import { describe, expect, it } from 'vitest'
import {
  OFFER_STATUS_LABELS,
  OFFER_STATUS_OPTIONS,
  isValidOfferTransition,
  isTerminalOfferStatus,
  isValidOfferStatus,
  isReservation,
  isActiveHold,
} from './offers'

describe('offers — labels/opciones', () => {
  it('8 estados', () => {
    expect(Object.keys(OFFER_STATUS_LABELS)).toHaveLength(8)
    expect(OFFER_STATUS_OPTIONS).toHaveLength(8)
  })
  it('validador de estado', () => {
    expect(isValidOfferStatus('ACEPTADA')).toBe(true)
    expect(isValidOfferStatus('X')).toBe(false)
  })
})

describe('máquina de estados', () => {
  it('transiciones válidas desde PROPUESTA', () => {
    expect(isValidOfferTransition('PROPUESTA', 'ACEPTADA')).toBe(true)
    expect(isValidOfferTransition('PROPUESTA', 'RECHAZADA')).toBe(true)
    expect(isValidOfferTransition('PROPUESTA', 'CONVERTIDA')).toBe(false)
  })
  it('ACEPTADA solo puede convertir o cancelar', () => {
    expect(isValidOfferTransition('ACEPTADA', 'CONVERTIDA')).toBe(true)
    expect(isValidOfferTransition('ACEPTADA', 'CANCELADA')).toBe(true)
    expect(isValidOfferTransition('ACEPTADA', 'PROPUESTA')).toBe(false)
  })
  it('estados terminales sin salida', () => {
    expect(isTerminalOfferStatus('CONVERTIDA')).toBe(true)
    expect(isTerminalOfferStatus('RECHAZADA')).toBe(true)
    expect(isTerminalOfferStatus('CANCELADA')).toBe(true)
    expect(isTerminalOfferStatus('PROPUESTA')).toBe(false)
    expect(isTerminalOfferStatus('ACEPTADA')).toBe(false)
  })
})

describe('reserva y hold', () => {
  it('reserva = ACEPTADA con señal > 0', () => {
    expect(isReservation('ACEPTADA', 1000)).toBe(true)
    expect(isReservation('ACEPTADA', null)).toBe(false)
    expect(isReservation('ACEPTADA', 0)).toBe(false)
    expect(isReservation('PROPUESTA', 1000)).toBe(false)
  })
  it('hold activo mientras la oferta viva', () => {
    expect(isActiveHold('PROPUESTA')).toBe(true)
    expect(isActiveHold('CONTRAOFERTA')).toBe(true)
    expect(isActiveHold('ACEPTADA')).toBe(true)
    expect(isActiveHold('RECHAZADA')).toBe(false)
    expect(isActiveHold('CONVERTIDA')).toBe(false)
  })
})
