import { describe, it, expect } from 'vitest'
import { normalizeRvSuggestion } from './normalize'

describe('normalizeRvSuggestion', () => {
  it('preserva una sugerencia válida', () => {
    const s = normalizeRvSuggestion({
      category: 'PERFILADA',
      bedLayout: 'ISLA',
      bathroomType: 'SEPARADO',
      heatingType: 'DIESEL',
      sleepingPlaces: 2,
      maxMassKg: 3500,
      heightM: 2.95,
      length: 6.99,
      winterized: true,
      hasGarage: false,
      offGrid: null,
      equipment: { solar: true, kitchen: true, shower: true, heating: true },
      notes: 'Perfilada típica de pareja.',
    })
    expect(s.category).toBe('PERFILADA')
    expect(s.bedLayout).toBe('ISLA')
    expect(s.maxMassKg).toBe(3500)
    expect(s.equipment.solar).toBe(true)
    expect(s.notes).toContain('pareja')
  })

  it('degrada un enum desconocido a null (no rompe)', () => {
    const s = normalizeRvSuggestion({ category: 'FURGO_RARA', bedLayout: 'CAMA_VOLADORA' })
    expect(s.category).toBeNull()
    expect(s.bedLayout).toBeNull()
  })

  it('descarta números fuera de rango', () => {
    const s = normalizeRvSuggestion({ sleepingPlaces: 99, maxMassKg: 500, heightM: 9 })
    expect(s.sleepingPlaces).toBeNull()
    expect(s.maxMassKg).toBeNull()
    expect(s.heightM).toBeNull()
  })

  it('rellena por defecto cuando faltan campos', () => {
    const s = normalizeRvSuggestion({ category: 'INTEGRAL' })
    expect(s.category).toBe('INTEGRAL')
    expect(s.bedLayout).toBeNull()
    expect(s.equipment).toEqual({ solar: false, kitchen: false, shower: false, heating: false })
    expect(s.notes).toBe('')
  })

  it('no lanza ante entradas basura', () => {
    expect(normalizeRvSuggestion(null).category).toBeNull()
    expect(normalizeRvSuggestion('texto').category).toBeNull()
    expect(normalizeRvSuggestion(42).equipment.solar).toBe(false)
  })

  it('coacciona equipment parcial o con tipos erróneos', () => {
    const s = normalizeRvSuggestion({ equipment: { solar: 'sí', kitchen: true } })
    expect(s.equipment.solar).toBe(false) // 'sí' no es boolean → false
    expect(s.equipment.kitchen).toBe(true)
    expect(s.equipment.shower).toBe(false)
  })
})
