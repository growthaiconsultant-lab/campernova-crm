import { describe, it, expect } from 'vitest'
import { evaluateOfficialEntryExpediente, isReadyForOfficialEntry } from './entry-expediente'

describe('isReadyForOfficialEntry (expediente mínimo de entrada oficial)', () => {
  it('acepta con matrícula presente (aunque no haya VIN)', () => {
    expect(isReadyForOfficialEntry({ plate: '1234-ABC', vin: null })).toBe(true)
    expect(evaluateOfficialEntryExpediente({ plate: '1234-ABC', vin: null })).toEqual({
      ok: true,
      missing: [],
    })
  })

  it('acepta con VIN presente aunque NO haya matrícula (vehículo aún no matriculado)', () => {
    expect(isReadyForOfficialEntry({ plate: null, vin: 'VF1ABCDEF12345678' })).toBe(true)
    expect(isReadyForOfficialEntry({ plate: '', vin: 'VF1ABCDEF12345678' })).toBe(true)
  })

  it('rechaza sin matrícula NI VIN (null / vacío / espacios en ambos)', () => {
    expect(isReadyForOfficialEntry({ plate: null, vin: null })).toBe(false)
    expect(evaluateOfficialEntryExpediente({ plate: null, vin: null })).toEqual({
      ok: false,
      missing: ['identificacion'],
    })
    expect(isReadyForOfficialEntry({ plate: '', vin: '' })).toBe(false)
    expect(isReadyForOfficialEntry({ plate: '   ', vin: '  ' })).toBe(false)
  })

  it('NO exige desiredPrice, fotografías, tasación ni datos comerciales', () => {
    // El tipo de entrada solo admite `plate` y `vin`: es imposible, a nivel de tipos, exigir precio
    // o fotos. Con un identificador presente, el expediente mínimo de entrada queda satisfecho.
    const input: Parameters<typeof isReadyForOfficialEntry>[0] = { plate: 'AAA-000', vin: null }
    expect(Object.keys(input).sort()).toEqual(['plate', 'vin'])
    expect(isReadyForOfficialEntry(input)).toBe(true)
  })
})
