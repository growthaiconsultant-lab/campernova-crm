import { describe, expect, it } from 'vitest'
import { classifyBuyerCriteria, type BuyerCriteriaInput } from './buyer-criteria'

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

describe('classifyBuyerCriteria', () => {
  it('sin criterios → lista vacía', () => {
    expect(classifyBuyerCriteria(empty)).toEqual([])
  })

  it('marca los filtros duros como excluyentes', () => {
    const res = classifyBuyerCriteria({
      ...empty,
      vehicleType: 'CAMPER',
      minSeats: 4,
      maxBudget: 45000,
      bathroomRequired: true,
      licenseType: 'B',
      maxLengthM: 6.5,
    })
    const hard = res.filter((c) => c.kind === 'excluyente').map((c) => c.label)
    expect(hard).toEqual(
      expect.arrayContaining(['Tipo', 'Plazas mín.', 'Presupuesto', 'Baño', 'Carnet', 'Largo máx.'])
    )
    expect(res.every((c) => c.kind === 'excluyente')).toBe(true)
  })

  it('marca distribución, cama, equipo y zona como preferencias', () => {
    const res = classifyBuyerCriteria({
      ...empty,
      preferredCategory: 'PERFILADA',
      preferredBedLayout: 'ISLA',
      criticalEquipment: { solar: true, heating: false },
      useZone: 'Cataluña',
      needsWinter: true,
    })
    expect(res.every((c) => c.kind === 'preferencia')).toBe(true)
    const equipo = res.filter((c) => c.label === 'Equipo')
    expect(equipo).toHaveLength(1) // solo solar (heating=false no cuenta)
    expect(res.some((c) => c.value === 'Cataluña')).toBe(true)
  })

  it('bathroomRequired=false no genera criterio', () => {
    const res = classifyBuyerCriteria({ ...empty, bathroomRequired: false })
    expect(res).toEqual([])
  })

  it('acepta maxBudget como string (Decimal serializado)', () => {
    const res = classifyBuyerCriteria({ ...empty, maxBudget: '50000' })
    expect(res[0].value).toContain('50.000')
  })
})
