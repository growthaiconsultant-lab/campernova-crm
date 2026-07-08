import { describe, expect, it } from 'vitest'
import { buyerScore, scoreLabel, type BuyerScoreInput } from './buyer'
import { sellerAcquisitionScore, priceRealismPoints } from './seller'

const baseBuyer: BuyerScoreInput = {
  phone: null,
  email: null,
  vehicleType: null,
  minSeats: null,
  maxBudget: null,
  financingNeeded: null,
  purchaseTimeline: null,
  temperature: null,
  status: 'NUEVO',
  bestMatchScore: 0,
  hasActiveOffer: false,
}

describe('buyerScore', () => {
  it('un lead vacío puntúa 0', () => {
    expect(buyerScore(baseBuyer).score).toBe(0)
  })

  it('lead completo y caliente con oferta se acerca a 100', () => {
    const r = buyerScore({
      phone: '600111222',
      email: 'a@b.com',
      vehicleType: 'CAMPER',
      minSeats: 4,
      maxBudget: 40000,
      financingNeeded: true,
      purchaseTimeline: 'menos_1_mes',
      temperature: 'HOT',
      status: 'EN_NEGOCIACION',
      bestMatchScore: 90,
      hasActiveOffer: true,
    })
    expect(r.score).toBeGreaterThanOrEqual(95)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('el desglose cubre todos los ejes y respeta los máximos', () => {
    const r = buyerScore(baseBuyer)
    expect(r.breakdown).toHaveLength(8)
    for (const item of r.breakdown) {
      expect(item.points).toBeLessThanOrEqual(item.max)
      expect(item.points).toBeGreaterThanOrEqual(0)
    }
  })

  it('nunca supera 100', () => {
    const r = buyerScore({
      ...baseBuyer,
      phone: 'x',
      email: 'x',
      vehicleType: 'CAMPER',
      minSeats: 4,
      maxBudget: 1,
      financingNeeded: false,
      purchaseTimeline: 'menos_1_mes',
      temperature: 'HOT',
      bestMatchScore: 100,
      hasActiveOffer: true,
    })
    expect(r.score).toBeLessThanOrEqual(100)
  })
})

describe('scoreLabel', () => {
  it('umbrales Alto/Medio/Bajo', () => {
    expect(scoreLabel(85)).toBe('Alto')
    expect(scoreLabel(70)).toBe('Alto')
    expect(scoreLabel(55)).toBe('Medio')
    expect(scoreLabel(40)).toBe('Medio')
    expect(scoreLabel(20)).toBe('Bajo')
  })
})

describe('priceRealismPoints', () => {
  it('pedir <= tasación es lo mejor', () => {
    expect(priceRealismPoints(38000, 40000)).toBe(25)
    expect(priceRealismPoints(40000, 40000)).toBe(25)
  })
  it('sobreprecio moderado puntúa menos', () => {
    expect(priceRealismPoints(44000, 40000)).toBe(18) // +10%
    expect(priceRealismPoints(47000, 40000)).toBe(10) // +17.5%
  })
  it('muy sobrevalorado = 0', () => {
    expect(priceRealismPoints(60000, 40000)).toBe(0)
  })
  it('sin datos → neutral', () => {
    expect(priceRealismPoints(null, 40000)).toBe(12)
    expect(priceRealismPoints(40000, null)).toBe(12)
  })
})

describe('sellerAcquisitionScore', () => {
  it('precio realista + urgencia alta + bajo riesgo + demanda alta → alto', () => {
    const r = sellerAcquisitionScore({
      desiredPrice: 38000,
      minPrice: 35000,
      valuationRecommended: 40000,
      urgency: 'ALTA',
      riskLevel: 'BAJO',
      activeDemandCount: 4,
    })
    expect(r.score).toBe(100) // 25 + 20 + 20 + 35
  })

  it('sin datos de condiciones → neutrales', () => {
    const r = sellerAcquisitionScore({
      desiredPrice: null,
      minPrice: null,
      valuationRecommended: null,
      urgency: null,
      riskLevel: null,
      activeDemandCount: 0,
    })
    // 12 (precio) + 10 (urgencia) + 10 (riesgo) + 0 (demanda)
    expect(r.score).toBe(32)
  })

  it('alto riesgo penaliza a 0 en su eje', () => {
    const r = sellerAcquisitionScore({
      desiredPrice: 40000,
      minPrice: null,
      valuationRecommended: 40000,
      urgency: 'MEDIA',
      riskLevel: 'ALTO',
      activeDemandCount: 1,
    })
    const risk = r.breakdown.find((i) => i.label === 'Riesgo (inverso)')
    expect(risk?.points).toBe(0)
  })
})
