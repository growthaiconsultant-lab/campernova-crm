import { describe, expect, it } from 'vitest'
import { vehiclePlateSearchConditions } from './vehicle-plate-search'

const values = (query: string) =>
  vehiclePlateSearchConditions(query).map(
    (condition) => (condition.plate as { contains: string }).contains
  )

describe('plate search layouts', () => {
  it.each(['1234ABC', '1234-abc', ' 1234 abc '])('accepts common layouts for %s', (query) => {
    expect(values(query).sort()).toEqual(['1234ABC', '1234 ABC', '1234-ABC'].sort())
  })
  it('supports fragments and older mixed letter/digit blocks', () => {
    expect(values('34ab')).toEqual(['34AB', '34 AB', '34-AB'])
    expect(values('B1234CD')).toContain('B-1234-CD')
    expect(values('B1234CD')).toContain('B 1234-CD')
    expect(values('1234')).toEqual(['1234'])
  })
  it('is bounded and does not generate wildcard matches', () => {
    expect(values('A1B2')).toHaveLength(27)
    expect(values('A1B2C3')).toEqual(['A1B2C3'])
    expect(values('A'.repeat(21))).toHaveLength(1)
    expect(values('%_\\')).toEqual(['\\%\\_\\\\'])
    expect(values('')).toEqual([])
    expect(values('   ')).toEqual([])
    expect(values('---')).toEqual(['---'])
  })
})
