import { describe, expect, it } from 'vitest'
import { calculateVehicleMargin } from './calculate'

const TARGET = 4.0

function make(overrides: Parameters<typeof calculateVehicleMargin>[0]) {
  return calculateVehicleMargin(overrides)
}

describe('calculateVehicleMargin', () => {
  it('calcula margen bruto y neto correctamente', () => {
    const r = make({
      purchasePrice: 28500,
      salePrice: 32000,
      marginPercentTarget: TARGET,
      costs: [{ category: 'LIMPIEZA', amount: 150 }],
    })
    expect(r.grossMargin).toBe(3500)
    expect(r.netMargin).toBe(3350)
    expect(r.totalCosts).toBe(150)
    expect(r.marginPercentReal).toBeCloseTo((3350 / 32000) * 100, 4)
  })

  it('sin costes: netMargin == grossMargin', () => {
    const r = make({
      purchasePrice: 20000,
      salePrice: 22000,
      marginPercentTarget: TARGET,
      costs: [],
    })
    expect(r.grossMargin).toBe(2000)
    expect(r.netMargin).toBe(2000)
    expect(r.totalCosts).toBe(0)
  })

  it('sin purchasePrice: grossMargin y netMargin son null', () => {
    const r = make({
      purchasePrice: null,
      salePrice: 32000,
      marginPercentTarget: TARGET,
      costs: [],
    })
    expect(r.grossMargin).toBeNull()
    expect(r.netMargin).toBeNull()
    expect(r.marginPercentReal).toBeNull()
  })

  it('sin salePrice: grossMargin y netMargin son null', () => {
    const r = make({
      purchasePrice: 28500,
      salePrice: null,
      marginPercentTarget: TARGET,
      costs: [],
    })
    expect(r.grossMargin).toBeNull()
    expect(r.netMargin).toBeNull()
    expect(r.marginPercentReal).toBeNull()
  })

  it('ambos null: todos los calculados son null', () => {
    const r = make({ purchasePrice: null, salePrice: null, marginPercentTarget: TARGET, costs: [] })
    expect(r.grossMargin).toBeNull()
    expect(r.netMargin).toBeNull()
    expect(r.marginPercentReal).toBeNull()
    expect(r.totalCosts).toBe(0)
  })

  it('costes > grossMargin → netMargin negativo', () => {
    const r = make({
      purchasePrice: 28500,
      salePrice: 29000,
      marginPercentTarget: TARGET,
      costs: [{ category: 'PIEZAS', amount: 800 }],
    })
    expect(r.grossMargin).toBe(500)
    expect(r.netMargin).toBe(-300)
    expect(r.isBelowTarget).toBe(true)
  })

  it('isBelowTarget true cuando marginPercentReal < marginPercentTarget', () => {
    const r = make({
      purchasePrice: 28500,
      salePrice: 29000,
      marginPercentTarget: 4,
      costs: [],
    })
    // grossMargin=500, netMargin=500, marginPercentReal=500/29000*100=1.72%
    expect(r.isBelowTarget).toBe(true)
  })

  it('isBelowTarget false cuando marginPercentReal >= marginPercentTarget', () => {
    const r = make({
      purchasePrice: 20000,
      salePrice: 25000,
      marginPercentTarget: 4,
      costs: [],
    })
    // netMargin=5000, marginPercentReal=5000/25000*100=20%
    expect(r.isBelowTarget).toBe(false)
  })

  it('agrupa costsByCategory correctamente con varias categorías', () => {
    const r = make({
      purchasePrice: 20000,
      salePrice: 25000,
      marginPercentTarget: TARGET,
      costs: [
        { category: 'PIEZAS', amount: 200 },
        { category: 'PIEZAS', amount: 100 },
        { category: 'LIMPIEZA', amount: 150 },
        { category: 'MANO_OBRA_TALLER', amount: 60 },
      ],
    })
    expect(r.costsByCategory['PIEZAS']).toBe(300)
    expect(r.costsByCategory['LIMPIEZA']).toBe(150)
    expect(r.costsByCategory['MANO_OBRA_TALLER']).toBe(60)
    expect(r.totalCosts).toBe(510)
  })

  it('marginPercentTarget se refleja en el output sin modificar', () => {
    const r = make({ purchasePrice: 10000, salePrice: 12000, marginPercentTarget: 6.5, costs: [] })
    expect(r.marginPercentTarget).toBe(6.5)
  })

  it('marginPercentReal se calcula sobre salePrice, no sobre purchasePrice', () => {
    // netMargin=2000, salePrice=12000 → 16.67%
    const r = make({
      purchasePrice: 10000,
      salePrice: 12000,
      marginPercentTarget: TARGET,
      costs: [],
    })
    expect(r.marginPercentReal).toBeCloseTo((2000 / 12000) * 100, 4)
  })

  it('salePrice = 0 → marginPercentReal null (evita división por cero)', () => {
    const r = make({ purchasePrice: 0, salePrice: 0, marginPercentTarget: TARGET, costs: [] })
    expect(r.marginPercentReal).toBeNull()
  })

  it('decimales de centavos se suman correctamente', () => {
    const r = make({
      purchasePrice: 10000,
      salePrice: 12000,
      marginPercentTarget: TARGET,
      costs: [
        { category: 'OTRO', amount: 33.33 },
        { category: 'OTRO', amount: 66.67 },
      ],
    })
    expect(r.totalCosts).toBeCloseTo(100, 5)
    expect(r.netMargin).toBeCloseTo(1900, 5)
  })

  it('isBelowTarget false si marginPercentReal es null', () => {
    const r = make({ purchasePrice: null, salePrice: null, marginPercentTarget: TARGET, costs: [] })
    expect(r.isBelowTarget).toBe(false)
  })
})
