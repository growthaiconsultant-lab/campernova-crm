import { describe, it, expect } from 'vitest'
import { resolveRange, isValidRangeKey, DEFAULT_RANGE } from './range'

// Fecha fija para tests deterministas: miércoles 15 de mayo de 2026, 10:30.
const NOW = new Date(2026, 4, 15, 10, 30, 0)

const DAY = 24 * 60 * 60 * 1000

describe('isValidRangeKey', () => {
  it('acepta las claves del catálogo', () => {
    expect(isValidRangeKey('7d')).toBe(true)
    expect(isValidRangeKey('mes-anterior')).toBe(true)
    expect(isValidRangeKey('ano')).toBe(true)
  })

  it('rechaza claves desconocidas, vacías o nulas', () => {
    expect(isValidRangeKey('14d')).toBe(false)
    expect(isValidRangeKey('')).toBe(false)
    expect(isValidRangeKey(undefined)).toBe(false)
    expect(isValidRangeKey(null)).toBe(false)
  })
})

describe('resolveRange', () => {
  it('usa el rango por defecto ante clave inválida o ausente', () => {
    expect(resolveRange(undefined, NOW).key).toBe(DEFAULT_RANGE)
    expect(resolveRange('bogus', NOW).key).toBe(DEFAULT_RANGE)
  })

  it('7d: ventana móvil de 7 días que termina ahora', () => {
    const r = resolveRange('7d', NOW)
    expect(r.end).toEqual(NOW)
    expect(r.start).toEqual(new Date(NOW.getTime() - 7 * DAY))
  })

  it('mes: del día 1 del mes actual hasta ahora', () => {
    const r = resolveRange('mes', NOW)
    expect(r.start).toEqual(new Date(2026, 4, 1, 0, 0, 0, 0))
    expect(r.end).toEqual(NOW)
  })

  it('mes-anterior: mes natural completo (abril 2026)', () => {
    const r = resolveRange('mes-anterior', NOW)
    expect(r.start).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0))
    expect(r.end).toEqual(new Date(2026, 4, 1, 0, 0, 0, 0))
  })

  it('mes-anterior en enero cruza de año (diciembre del año previo)', () => {
    const january = new Date(2026, 0, 10, 9, 0, 0)
    const r = resolveRange('mes-anterior', january)
    expect(r.start).toEqual(new Date(2025, 11, 1, 0, 0, 0, 0))
    expect(r.end).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0))
  })

  it('trimestre: desde el inicio del trimestre natural (Q2 = 1 abril)', () => {
    const r = resolveRange('trimestre', NOW)
    expect(r.start).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0))
    expect(r.end).toEqual(NOW)
  })

  it('ano: desde el 1 de enero', () => {
    const r = resolveRange('ano', NOW)
    expect(r.start).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0))
    expect(r.end).toEqual(NOW)
  })

  it('el periodo anterior tiene la misma duración y termina donde empieza el actual', () => {
    for (const key of ['7d', '30d', '90d', 'mes', 'mes-anterior', 'trimestre', 'ano'] as const) {
      const r = resolveRange(key, NOW)
      const duration = r.end.getTime() - r.start.getTime()
      expect(r.prevEnd).toEqual(r.start)
      expect(r.prevEnd.getTime() - r.prevStart.getTime()).toBe(duration)
      expect(duration).toBeGreaterThan(0)
    }
  })
})
