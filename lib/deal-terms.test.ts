import { describe, expect, it } from 'vitest'
import {
  SELLER_DEAL_TYPE_LABELS,
  SELLER_URGENCY_LABELS,
  SELLER_RISK_LABELS,
  SELLER_DEAL_TYPE_OPTIONS,
  SELLER_URGENCY_OPTIONS,
  SELLER_RISK_OPTIONS,
  isValidSellerDealType,
  isValidSellerUrgency,
  isValidSellerRisk,
} from './deal-terms'

describe('deal-terms', () => {
  it('cuenta de labels', () => {
    expect(Object.keys(SELLER_DEAL_TYPE_LABELS)).toHaveLength(4)
    expect(Object.keys(SELLER_URGENCY_LABELS)).toHaveLength(3)
    expect(Object.keys(SELLER_RISK_LABELS)).toHaveLength(3)
  })

  it('las opciones reflejan los labels', () => {
    expect(SELLER_DEAL_TYPE_OPTIONS).toHaveLength(4)
    expect(SELLER_URGENCY_OPTIONS.map((o) => o.value)).toEqual(['ALTA', 'MEDIA', 'BAJA'])
    expect(SELLER_RISK_OPTIONS[0]).toEqual({ value: 'BAJO', label: 'Bajo' })
  })

  it('validadores', () => {
    expect(isValidSellerDealType('DEPOSITO_VENTA')).toBe(true)
    expect(isValidSellerDealType('OTRO')).toBe(false)
    expect(isValidSellerUrgency('ALTA')).toBe(true)
    expect(isValidSellerUrgency('URGENTE')).toBe(false)
    expect(isValidSellerRisk('MEDIO')).toBe(true)
    expect(isValidSellerRisk('X')).toBe(false)
  })
})
