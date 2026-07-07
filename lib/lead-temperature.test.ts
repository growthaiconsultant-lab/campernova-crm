import { describe, expect, it } from 'vitest'
import {
  isValidTemperature,
  suggestTemperatureFromTimeline,
  TEMPERATURE_LABELS,
  TEMPERATURE_OPTIONS,
} from './lead-temperature'

describe('suggestTemperatureFromTimeline', () => {
  it('compra en <1 mes → HOT', () => {
    expect(suggestTemperatureFromTimeline('menos_1_mes')).toBe('HOT')
  })

  it('1-3 meses → WARM', () => {
    expect(suggestTemperatureFromTimeline('1_3_meses')).toBe('WARM')
  })

  it('plazos largos → COLD', () => {
    expect(suggestTemperatureFromTimeline('3_6_meses')).toBe('COLD')
    expect(suggestTemperatureFromTimeline('mas_6_meses')).toBe('COLD')
    expect(suggestTemperatureFromTimeline('sin_prisa')).toBe('COLD')
  })

  it('desconocido o null → COLD', () => {
    expect(suggestTemperatureFromTimeline(null)).toBe('COLD')
    expect(suggestTemperatureFromTimeline(undefined)).toBe('COLD')
    expect(suggestTemperatureFromTimeline('cualquier_cosa')).toBe('COLD')
  })
})

describe('isValidTemperature', () => {
  it('acepta los 3 valores del enum', () => {
    for (const opt of TEMPERATURE_OPTIONS) {
      expect(isValidTemperature(opt.value)).toBe(true)
    }
    expect(Object.keys(TEMPERATURE_LABELS)).toHaveLength(3)
  })

  it('rechaza valores desconocidos', () => {
    expect(isValidTemperature('TIBIO')).toBe(false)
    expect(isValidTemperature('')).toBe(false)
  })
})
