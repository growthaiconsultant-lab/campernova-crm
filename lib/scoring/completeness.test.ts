import { describe, expect, it } from 'vitest'
import {
  buyerCompleteness,
  sellerCompleteness,
  vehicleCompleteness,
  operationStructure,
  STRUCTURED_THRESHOLD,
} from './completeness'

describe('buyerCompleteness', () => {
  it('ficha vacía → 0', () => {
    expect(
      buyerCompleteness({
        maxBudget: null,
        vehicleType: null,
        purchaseTimeline: null,
        financingNeeded: null,
        useZone: null,
        minSeats: null,
        sleepingPlacesRequired: null,
        hasMustHaves: false,
        hasDealBreakers: false,
        nextActionType: null,
      }).score
    ).toBe(0)
  })
  it('ficha completa → 100', () => {
    expect(
      buyerCompleteness({
        maxBudget: 40000,
        vehicleType: 'CAMPER',
        purchaseTimeline: 'menos_1_mes',
        financingNeeded: true,
        useZone: 'Costa',
        minSeats: 4,
        sleepingPlacesRequired: 2,
        hasMustHaves: true,
        hasDealBreakers: true,
        nextActionType: 'LLAMAR',
      }).score
    ).toBe(100)
  })
})

describe('vehicleCompleteness', () => {
  it('pesos suman 100 con ficha completa', () => {
    const r = vehicleCompleteness({
      hasBasics: true,
      price: 39000,
      type: 'AUTOCARAVANA',
      seats: 4,
      sleepingPlaces: 4,
      location: 'Barcelona',
      conservationState: 'BUENO',
      hasEquipment: true,
      hasDocs: true,
      photoCount: 6,
    })
    expect(r.score).toBe(100)
    expect(r.breakdown).toHaveLength(9)
  })
  it('sin plazas para dormir → resta 5 de ese eje', () => {
    const r = vehicleCompleteness({
      hasBasics: true,
      price: 39000,
      type: 'AUTOCARAVANA',
      seats: 4,
      sleepingPlaces: null,
      location: 'Barcelona',
      conservationState: 'BUENO',
      hasEquipment: true,
      hasDocs: true,
      photoCount: 6,
    })
    expect(r.score).toBe(95)
  })
})

describe('sellerCompleteness', () => {
  it('respeta máximos por eje', () => {
    const r = sellerCompleteness({
      hasVehicleBasics: true,
      desiredPrice: 40000,
      minPrice: 36000,
      location: 'Girona',
      urgency: 'ALTA',
      dealType: 'DEPOSITO_VENTA',
      riskAssessed: true,
      hasDocs: true,
      hasPhotos: true,
      nextActionType: 'LLAMAR',
    })
    expect(r.score).toBe(100)
    for (const i of r.breakdown) expect(i.points).toBeLessThanOrEqual(i.max)
  })
})

describe('operationStructure', () => {
  const full = {
    buyerScore: 80,
    vehicleScore: 75,
    hasValuation: true,
    hasMatch: true,
    hasWorkflowStatus: true,
    hasNextAction: true,
  }
  it('todos los gates cumplidos → estructurada', () => {
    expect(operationStructure(full).isStructured).toBe(true)
    expect(operationStructure(full).missing).toHaveLength(0)
  })
  it('lista lo que falta', () => {
    const r = operationStructure({ ...full, hasValuation: false, buyerScore: 50 })
    expect(r.isStructured).toBe(false)
    expect(r.missing).toContain('Sin valoración')
    expect(r.missing).toContain('Ficha de comprador incompleta')
  })
  it('umbral en el límite', () => {
    expect(operationStructure({ ...full, buyerScore: STRUCTURED_THRESHOLD }).isStructured).toBe(
      true
    )
    expect(operationStructure({ ...full, buyerScore: STRUCTURED_THRESHOLD - 1 }).isStructured).toBe(
      false
    )
  })
})
