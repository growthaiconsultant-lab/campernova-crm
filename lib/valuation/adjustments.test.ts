import { describe, expect, it } from 'vitest'
import { conservationFactor, equipmentFactor, yearFactor } from './adjustments'

describe('conservationFactor', () => {
  it('penaliza vehículos deteriorados (-10%)', () => {
    expect(conservationFactor('DETERIORADO')).toBe(0.9)
  })

  it('mantiene precio para BUENO (factor 1)', () => {
    expect(conservationFactor('BUENO')).toBe(1)
  })

  it('premia EXCELENTE (+5%)', () => {
    expect(conservationFactor('EXCELENTE')).toBe(1.05)
  })

  it('reduce ligeramente NORMAL (-3%)', () => {
    expect(conservationFactor('NORMAL')).toBe(0.97)
  })
})

describe('equipmentFactor', () => {
  it('sin equipamiento premium → factor 1', () => {
    expect(equipmentFactor({})).toBe(1)
    expect(equipmentFactor({ kitchen: true })).toBe(1)
  })

  it('cocina no es premium', () => {
    expect(equipmentFactor({ kitchen: true })).toBe(1)
  })

  it('+2% por cada item premium (solar, bathroom, shower, heating)', () => {
    expect(equipmentFactor({ solar: true })).toBe(1.02)
    expect(equipmentFactor({ solar: true, bathroom: true })).toBeCloseTo(1.04, 5)
    expect(equipmentFactor({ solar: true, bathroom: true, shower: true })).toBeCloseTo(1.06, 5)
  })

  it('todos los premium → +8%', () => {
    expect(
      equipmentFactor({ solar: true, bathroom: true, shower: true, heating: true })
    ).toBeCloseTo(1.08, 5)
  })

  it('flags falsos no cuentan', () => {
    expect(equipmentFactor({ solar: false, bathroom: true })).toBe(1.02)
  })
})

describe('yearFactor', () => {
  it('mismo año → factor 1', () => {
    expect(yearFactor(2020, 2020)).toBe(1)
  })

  it('vehículo más viejo se deprecia 8% por año', () => {
    expect(yearFactor(2019, 2020)).toBeCloseTo(0.92, 5)
    expect(yearFactor(2018, 2020)).toBeCloseTo(0.8464, 4)
  })

  it('vehículo más nuevo se aprecia 5% por año', () => {
    expect(yearFactor(2021, 2020)).toBeCloseTo(1.05, 5)
    expect(yearFactor(2022, 2020)).toBeCloseTo(1.1025, 4)
  })
})
