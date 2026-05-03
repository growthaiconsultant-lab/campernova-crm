import { describe, expect, it } from 'vitest'
import { scoreAgeKm, scoreEquipment, scorePrice, scoreZone } from './scoring'

describe('scoreEquipment', () => {
  it('sin requisitos del comprador → 100', () => {
    expect(scoreEquipment({ solar: true }, {})).toBe(100)
    expect(scoreEquipment({}, { solar: false })).toBe(100)
  })

  it('todos los requisitos cumplidos → 100', () => {
    expect(
      scoreEquipment(
        { solar: true, bathroom: true, heating: true, kitchen: true },
        { solar: true, bathroom: true }
      )
    ).toBe(100)
  })

  it('mitad de requisitos cumplidos → 50', () => {
    expect(scoreEquipment({ solar: true }, { solar: true, bathroom: true })).toBe(50)
  })

  it('ningún requisito cumplido → 0', () => {
    expect(scoreEquipment({ kitchen: true }, { solar: true, bathroom: true })).toBe(0)
  })

  it('flags falsos del comprador no cuentan como requisito', () => {
    expect(scoreEquipment({}, { solar: false, bathroom: true })).toBe(0)
    expect(scoreEquipment({ bathroom: true }, { solar: false, bathroom: true })).toBe(100)
  })
})

describe('scorePrice', () => {
  it('sin presupuesto del comprador → 100', () => {
    expect(scorePrice(50_000, null)).toBe(100)
    expect(scorePrice(null, null)).toBe(100)
  })

  it('vehículo sin precio pero presupuesto definido → 50 (neutral)', () => {
    expect(scorePrice(null, 30_000)).toBe(50)
  })

  it('precio ≤90% del presupuesto → 100', () => {
    expect(scorePrice(27_000, 30_000)).toBe(100)
    expect(scorePrice(15_000, 30_000)).toBe(100)
  })

  it('precio = 100% del presupuesto → 50', () => {
    expect(scorePrice(30_000, 30_000)).toBe(50)
  })

  it('precio = 110% del presupuesto → 0 (límite del filtro duro)', () => {
    expect(scorePrice(33_000, 30_000)).toBe(0)
  })

  it('decae linealmente entre 90% y 110%', () => {
    // 95% → mitad de la rampa → ~75
    expect(scorePrice(28_500, 30_000)).toBe(75)
  })
})

describe('scoreAgeKm', () => {
  it('vehículo del año actual con 0 km → 100', () => {
    expect(scoreAgeKm(2026, 0, 2026)).toBe(100)
  })

  it('vehículo de hace 15 años con 200.000 km → 0', () => {
    expect(scoreAgeKm(2011, 200_000, 2026)).toBe(0)
  })

  it('año actual pero 200.000 km → 50 (solo año aporta)', () => {
    expect(scoreAgeKm(2026, 200_000, 2026)).toBe(50)
  })

  it('15 años pero 0 km → 50 (solo km aporta)', () => {
    expect(scoreAgeKm(2011, 0, 2026)).toBe(50)
  })

  it('mitad de antigüedad y mitad de km → ~50', () => {
    expect(scoreAgeKm(2018, 100_000, 2026)).toBe(48)
  })

  it('vehículos más viejos del floor cuentan como 0 en ese eje', () => {
    expect(scoreAgeKm(2000, 0, 2026)).toBe(50)
  })
})

describe('scoreZone', () => {
  it('comprador sin preferencia → 100', () => {
    expect(scoreZone('Madrid', null)).toBe(100)
    expect(scoreZone(null, null)).toBe(100)
    expect(scoreZone('Madrid', '')).toBe(100)
    expect(scoreZone('Madrid', '   ')).toBe(100)
  })

  it('match exacto case-insensitive → 100', () => {
    expect(scoreZone('Madrid', 'madrid')).toBe(100)
    expect(scoreZone('  Barcelona ', 'BARCELONA')).toBe(100)
  })

  it('no coincide → 0', () => {
    expect(scoreZone('Madrid', 'Barcelona')).toBe(0)
  })

  it('vehículo sin ubicación pero comprador la pide → 0', () => {
    expect(scoreZone(null, 'Madrid')).toBe(0)
  })
})
