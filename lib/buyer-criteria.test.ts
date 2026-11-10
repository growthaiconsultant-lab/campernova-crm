import { describe, expect, it } from 'vitest'
import { buyerSearchCriteria, type BuyerCriteriaInput } from './buyer-criteria'

const empty: BuyerCriteriaInput = {
  vehicleType: null,
  minSeats: null,
  maxBudget: null,
  sleepingPlacesRequired: null,
  bathroomRequired: null,
  licenseType: null,
  maxLengthM: null,
  maxHeightM: null,
  preferredCategory: null,
  preferredBedLayout: null,
  criticalEquipment: null,
  useZone: null,
  needsWinter: null,
  needsGarage: null,
  hasKids: null,
}

describe('resumen de la búsqueda', () => {
  it('no inventa requisitos en una ficha vacía', () => {
    expect(buyerSearchCriteria(empty, {})).toEqual({
      family: undefined,
      required: [],
      preferred: [],
    })
  })
  it('distingue equipamiento imprescindible de opciones deseadas', () => {
    const result = buyerSearchCriteria(
      {
        ...empty,
        vehicleType: 'CAMPER',
        bathroomRequired: true,
        needsWinter: true,
        criticalEquipment: { solar: true },
        maxHeightM: 2.65,
      },
      {
        solar: { values: ['Sí'] },
        gearbox: { values: ['Automático'] },
        beds: { values: ['Literas', 'Camas gemelas'] },
      }
    )
    expect(result.family).toBe('Camper')
    expect(result.required).toEqual([
      'Baño interior',
      'Altura máxima de 2,65 m',
      'Preparación para invierno',
      'Placas solares',
    ])
    expect(result.preferred).toContain('Cambio · Automático')
    expect(result.preferred).toContain('Distribuciones de cama · Literas o Camas gemelas')
  })
  it('conserva los límites, prioridades y alternativas del catálogo', () => {
    const result = buyerSearchCriteria(empty, {
      family: { values: ['Camper', 'Autocaravana'] },
      year: { values: ['2020'], required: true },
      showerOptions: {
        values: ['Interior', 'Independiente del inodoro'],
        all: true,
        required: true,
      },
    })
    expect(result.family).toBe('Camper o Autocaravana')
    expect(result.required).toContain('Opciones de ducha · Interior y Independiente del inodoro')
    expect(result.required).toContain('Año de matriculación · mínimo 2020')
  })
  it('conserva la familia de la ficha y el criterio detallado cuando difieren', () => {
    const result = buyerSearchCriteria(
      { ...empty, vehicleType: 'CAMPER', needsGarage: true },
      { family: { values: ['Autocaravana'], required: true } }
    )
    expect(result.family).toBe('Camper')
    expect(result.required).toContain('Familia · Autocaravana')
    expect(result.required).toContain('Garaje para equipaje en el vehículo')
  })
})
