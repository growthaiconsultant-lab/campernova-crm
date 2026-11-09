import { describe, expect, it } from 'vitest'
import { editableCharacteristics, legacyProjection, vehicleFacts } from './vehicle-characteristics'

describe('ficha de vehículo', () => {
  const legacy = {
    equipment: { solar: false, kitchen: true, shower: false },
    bedLayout: 'GEMELAS',
    heatingType: 'DIESEL',
    bathroomType: 'HUMEDO',
  } as const
  it('conserva las dos camas, distingue por confirmar y respeta el No explícito', () => {
    const facts = vehicleFacts(
      { beds: { values: ['Superior'] }, kitchen: { values: ['No'] } },
      legacy
    )
    expect(facts.beds.values).toEqual(['Superior', 'Camas gemelas'])
    expect(facts.solar).toBeUndefined()
    expect(facts.kitchen.values).toEqual(['No'])
    expect(facts.heating.values).toEqual(['Sí'])
    expect(facts.shower.values).toEqual(['Sí'])
  })
  it('al retirar los detalles y guardar permite volver a por confirmar', () => {
    const edit = editableCharacteristics({ garageBikes: { values: ['2'] } }, legacy)
    delete edit.showerOptions
    delete edit.garageBikes
    const old = legacyProjection(edit, legacy)
    const reopened = vehicleFacts(edit, old)
    expect(old.bathroomType).toBeNull()
    expect(reopened.shower).toBeUndefined()
    expect(reopened.garage).toBeUndefined()
    expect(reopened.beds.values).toEqual(['Camas gemelas'])
  })
})
