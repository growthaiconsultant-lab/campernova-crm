import { describe, it, expect } from 'vitest'
import { vehicleLabel, personLabel, initialOf, shortIdSuffix } from './display'

describe('CAP-1 · fallbacks de presentación (computados, nunca persistidos)', () => {
  it('vehicleLabel: con marca/modelo (+año); sin datos → "Vehículo sin identificar"', () => {
    expect(vehicleLabel({ brand: 'VW', model: 'California', year: 2020 })).toBe(
      'VW California (2020)'
    )
    expect(vehicleLabel({ brand: 'VW', model: null })).toBe('VW')
    expect(vehicleLabel({ brand: null, model: null })).toBe('Vehículo sin identificar')
    expect(vehicleLabel({ brand: null, model: null, id: 'abc123def' }, { withId: true })).toBe(
      'Vehículo sin identificar · 3def'
    )
  })

  it('personLabel: con nombre; sin nombre → rol/fallback + sufijo', () => {
    expect(personLabel('Ana')).toBe('Ana')
    expect(personLabel('  ')).toBe('Sin identificar')
    expect(personLabel(null, { role: 'Vendedor' })).toBe('Vendedor')
    expect(personLabel(null, { role: 'Comprador', id: 'xyz7890' })).toBe('Comprador · 7890')
  })

  it('initialOf: inicial en mayúscula o "?" si falta; nunca cadena vacía', () => {
    expect(initialOf('ana')).toBe('A')
    expect(initialOf(null)).toBe('?')
    expect(initialOf('   ')).toBe('?')
  })

  it('shortIdSuffix: últimos N chars; vacío si no hay id', () => {
    expect(shortIdSuffix('cms4abcd1234')).toBe('1234')
    expect(shortIdSuffix(null)).toBe('')
  })

  it('nunca devuelve "", null ni undefined', () => {
    for (const s of [vehicleLabel({}), personLabel(null), initialOf(null)]) {
      expect(s).toBeTruthy()
      expect(typeof s).toBe('string')
    }
  })
})
