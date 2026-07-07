import { describe, expect, it } from 'vitest'
import { normalizePhone, phonesMatch } from './phone'

describe('normalizePhone', () => {
  it('añade 34 a móviles españoles de 9 dígitos (6xx/7xx)', () => {
    expect(normalizePhone('600111222')).toBe('34600111222')
    expect(normalizePhone('712345678')).toBe('34712345678')
  })

  it('no prefija números que no son móviles ES de 9 dígitos', () => {
    expect(normalizePhone('12345')).toBe('12345')
  })

  it('respeta el formato con espacios/guiones', () => {
    expect(normalizePhone('600 11 22 33')).toBe('34600112233')
    expect(normalizePhone('+34 600-11-22-33')).toBe('34600112233')
  })

  it('quita el doble cero internacional', () => {
    expect(normalizePhone('0034600111222')).toBe('34600111222')
  })

  it('deja intactos números ya con prefijo', () => {
    expect(normalizePhone('34600111222')).toBe('34600111222')
  })
})

describe('phonesMatch', () => {
  it('coincide entre formatos distintos del mismo número', () => {
    expect(phonesMatch('600111222', '+34 600 11 12 22')).toBe(true)
    expect(phonesMatch('0034600111222', '600111222')).toBe(true)
  })

  it('no coincide con números distintos', () => {
    expect(phonesMatch('600111222', '600111223')).toBe(false)
  })

  it('vacío/null nunca coincide', () => {
    expect(phonesMatch(null, '600111222')).toBe(false)
    expect(phonesMatch('600111222', '')).toBe(false)
    expect(phonesMatch('', '')).toBe(false)
  })
})
