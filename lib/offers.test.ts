import { describe, expect, it } from 'vitest'
import {
  OFFER_STATUS_LABELS,
  OFFER_STATUS_OPTIONS,
  isValidOfferTransition,
  isTerminalOfferStatus,
  isValidOfferStatus,
  isValidDepositAmount,
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

describe('isValidDepositAmount (I2A)', () => {
  it('acepta null: aceptar sin señal es legítimo', () => {
    expect(isValidDepositAmount(null)).toBe(true)
    expect(isValidDepositAmount(undefined)).toBe(true)
  })

  it('acepta cero y positivos', () => {
    expect(isValidDepositAmount(0)).toBe(true)
    expect(isValidDepositAmount(500)).toBe(true)
    expect(isValidDepositAmount(1234.56)).toBe(true)
  })

  it('rechaza importes negativos', () => {
    expect(isValidDepositAmount(-1)).toBe(false)
    expect(isValidDepositAmount(-0.01)).toBe(false)
    expect(isValidDepositAmount(-5000)).toBe(false)
  })

  it('rechaza valores no finitos: el formulario acepta texto libre', () => {
    expect(isValidDepositAmount(Number.NaN)).toBe(false)
    expect(isValidDepositAmount(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isValidDepositAmount(Number.NEGATIVE_INFINITY)).toBe(false)
  })

  it('no altera la semántica de reserva: sigue exigiendo señal > 0', () => {
    // Una señal de 0 es válida como entrada pero NO convierte la oferta en reserva.
    expect(isValidDepositAmount(0)).toBe(true)
    expect(isReservation('ACEPTADA', 0)).toBe(false)
    expect(isReservation('ACEPTADA', null)).toBe(false)
    expect(isReservation('ACEPTADA', 500)).toBe(true)
  })

  it('ACEPTADA sigue inmovilizando stock con o sin señal', () => {
    expect(isActiveHold('ACEPTADA')).toBe(true)
  })
})
