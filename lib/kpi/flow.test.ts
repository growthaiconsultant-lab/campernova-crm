import { describe, it, expect } from 'vitest'
import { computeDelta } from './flow'

describe('computeDelta', () => {
  it('calcula la variación % redondeada', () => {
    expect(computeDelta(12, 10)).toBe(20)
    expect(computeDelta(5, 10)).toBe(-50)
    expect(computeDelta(10, 10)).toBe(0)
    expect(computeDelta(1, 3)).toBe(-67)
  })

  it('devuelve null cuando el periodo anterior es 0 (no comparable)', () => {
    expect(computeDelta(5, 0)).toBeNull()
    expect(computeDelta(0, 0)).toBeNull()
  })
})
