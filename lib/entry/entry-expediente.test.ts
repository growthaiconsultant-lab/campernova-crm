import { describe, it, expect } from 'vitest'
import { evaluateOfficialEntryExpediente, isReadyForOfficialEntry } from './entry-expediente'

describe('isReadyForOfficialEntry (expediente mínimo de entrada oficial)', () => {
  it('acepta con matrícula presente', () => {
    expect(isReadyForOfficialEntry({ plate: '1234-ABC' })).toBe(true)
    expect(evaluateOfficialEntryExpediente({ plate: '1234-ABC' })).toEqual({
      ok: true,
      missing: [],
    })
  })

  it('rechaza sin matrícula (null / vacío / espacios)', () => {
    expect(isReadyForOfficialEntry({ plate: null })).toBe(false)
    expect(evaluateOfficialEntryExpediente({ plate: null })).toEqual({
      ok: false,
      missing: ['plate'],
    })
    expect(isReadyForOfficialEntry({ plate: '' })).toBe(false)
    expect(isReadyForOfficialEntry({ plate: '   ' })).toBe(false)
  })

  it('NO exige desiredPrice, fotografías, tasación ni datos comerciales', () => {
    // El tipo de entrada solo admite `plate`: es imposible, a nivel de tipos, exigir precio o fotos.
    // Con solo la matrícula, el expediente mínimo de entrada queda satisfecho.
    const input: Parameters<typeof isReadyForOfficialEntry>[0] = { plate: 'AAA-000' }
    expect(Object.keys(input)).toEqual(['plate'])
    expect(isReadyForOfficialEntry(input)).toBe(true)
  })
})
