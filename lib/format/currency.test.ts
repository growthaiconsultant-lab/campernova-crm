import { describe, it, expect } from 'vitest'
import { formatEur } from './currency'

const NBSP = String.fromCharCode(0xa0)

describe('formatEur', () => {
  it('formatea con agrupación es-ES y el símbolo de euro', () => {
    expect(formatEur(45000)).toBe(`45.000${NBSP}€`)
    expect(formatEur(0)).toBe(`0${NBSP}€`)
    expect(formatEur(1234567)).toBe(`1.234.567${NBSP}€`)
  })

  it('redondea a euros enteros (sin decimales)', () => {
    expect(formatEur(38000.6)).toBe(`38.001${NBSP}€`)
  })

  it('separa importe y símbolo con U+00A0 fijo, nunca el espacio estrecho U+202F', () => {
    // Blinda contra la variación de espacio de ICU en el estilo `currency`
    // (U+00A0 vs U+202F) que provocaba el error de hidratación: el separador
    // debe ser U+00A0 en cualquier runtime.
    const s = formatEur(45000)
    expect(s).not.toContain(String.fromCharCode(0x202f))
    // El carácter previo al símbolo € debe ser el espacio duro U+00A0.
    expect(s.charCodeAt(s.length - 2)).toBe(0xa0)
  })
})
