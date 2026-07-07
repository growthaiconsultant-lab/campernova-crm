import { describe, expect, it } from 'vitest'
import {
  isStockEligibleTradeIn,
  isValidTradeInType,
  tradeInTypeToVehicleType,
  TRADE_IN_TYPE_LABELS,
  TRADE_IN_TYPE_OPTIONS,
} from './trade-in'

describe('isStockEligibleTradeIn', () => {
  it('camper y autocaravana son captación de stock', () => {
    expect(isStockEligibleTradeIn('CAMPER')).toBe(true)
    expect(isStockEligibleTradeIn('AUTOCARAVANA')).toBe(true)
  })

  it('coche, moto, furgoneta, otro NO son stock', () => {
    expect(isStockEligibleTradeIn('COCHE')).toBe(false)
    expect(isStockEligibleTradeIn('MOTO')).toBe(false)
    expect(isStockEligibleTradeIn('FURGONETA')).toBe(false)
    expect(isStockEligibleTradeIn('OTRO')).toBe(false)
  })

  it('null/undefined → false', () => {
    expect(isStockEligibleTradeIn(null)).toBe(false)
    expect(isStockEligibleTradeIn(undefined)).toBe(false)
  })
})

describe('tradeInTypeToVehicleType', () => {
  it('mapea los tipos elegibles', () => {
    expect(tradeInTypeToVehicleType('CAMPER')).toBe('CAMPER')
    expect(tradeInTypeToVehicleType('AUTOCARAVANA')).toBe('AUTOCARAVANA')
  })

  it('devuelve null para tipos no-stock', () => {
    expect(tradeInTypeToVehicleType('COCHE')).toBeNull()
    expect(tradeInTypeToVehicleType('MOTO')).toBeNull()
  })
})

describe('isValidTradeInType', () => {
  it('acepta los 6 tipos del enum', () => {
    for (const opt of TRADE_IN_TYPE_OPTIONS) {
      expect(isValidTradeInType(opt.value)).toBe(true)
    }
    expect(Object.keys(TRADE_IN_TYPE_LABELS)).toHaveLength(6)
  })

  it('rechaza valores desconocidos', () => {
    expect(isValidTradeInType('BARCO')).toBe(false)
    expect(isValidTradeInType('')).toBe(false)
  })
})
