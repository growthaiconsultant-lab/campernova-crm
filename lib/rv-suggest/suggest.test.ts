import { describe, it, expect } from 'vitest'
import { buildRvSuggestUserText } from './suggest'

describe('buildRvSuggestUserText', () => {
  const base = {
    brand: 'Pilote',
    model: 'P696',
    year: 2022,
    km: 21000,
    type: 'AUTOCARAVANA' as const,
    seats: 4,
  }

  it('incluye los datos conocidos del vehículo', () => {
    const text = buildRvSuggestUserText(base)
    expect(text).toContain('Pilote')
    expect(text).toContain('P696')
    expect(text).toContain('2022')
    expect(text).toContain('AUTOCARAVANA')
    expect(text).toContain('21000')
  })

  it('incluye longitud y conservación solo si están presentes', () => {
    const withExtra = buildRvSuggestUserText({ ...base, length: 7.5, conservationState: 'BUENO' })
    expect(withExtra).toContain('7.5')
    expect(withExtra).toContain('BUENO')

    const without = buildRvSuggestUserText(base)
    expect(without).not.toContain('Longitud conocida')
    expect(without).not.toContain('conservación')
  })
})
