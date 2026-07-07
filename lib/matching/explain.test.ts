import { describe, expect, it } from 'vitest'
import { explainMatch } from './explain'
import type { MatchingBuyerInput, MatchingVehicleInput, ScoreBreakdown } from './types'

const baseVehicle: MatchingVehicleInput = {
  id: 'v1',
  type: 'AUTOCARAVANA',
  seats: 4,
  year: 2021,
  km: 40000,
  equipment: { solar: true, heating: true, shower: true },
  location: 'Barcelona',
  price: 45000,
  category: 'PERFILADA',
  bedLayout: 'GEMELAS',
  sleepingPlaces: 4,
  bathroomType: 'HUMEDO',
  maxMassKg: 3500,
  length: 6.4,
  heightM: 2.9,
}

const baseBuyer: MatchingBuyerInput = {
  id: 'b1',
  vehicleType: 'AUTOCARAVANA',
  minSeats: 4,
  maxBudget: 50000,
  criticalEquipment: { solar: true, heating: true },
  useZone: 'Barcelona',
  preferredCategory: 'PERFILADA',
  preferredBedLayout: 'GEMELAS',
  sleepingPlacesRequired: 4,
  bathroomRequired: true,
  licenseType: 'B',
  maxLengthM: 7,
  maxHeightM: 3,
}

const perfectBreakdown: ScoreBreakdown = {
  category: 100,
  bedLayout: 100,
  equipment: 100,
  price: 100,
  ageKm: 90,
  zone: 100,
}

describe('explainMatch — encaje perfecto', () => {
  it('lista motivos y no riesgos', () => {
    const { reasons, risks } = explainMatch(baseVehicle, baseBuyer, perfectBreakdown)
    expect(risks).toHaveLength(0)
    expect(reasons.some((r) => r.includes('Distribución'))).toBe(true)
    expect(reasons.some((r) => r.includes('Cama'))).toBe(true)
    expect(reasons.some((r) => r.includes('equipamiento crítico'))).toBe(true)
    expect(reasons.some((r) => r.includes('presupuesto'))).toBe(true)
    expect(reasons.some((r) => r.includes('En su zona'))).toBe(true)
  })
})

describe('explainMatch — riesgos', () => {
  it('precio alto → riesgo con importe', () => {
    const vehicle = { ...baseVehicle, price: 54000 }
    const { risks } = explainMatch(vehicle, baseBuyer, { ...perfectBreakdown, price: 40 })
    expect(risks.some((r) => r.includes('presupuesto'))).toBe(true)
  })

  it('equipamiento incompleto → lista lo que falta', () => {
    const vehicle = { ...baseVehicle, equipment: { solar: true } } // falta heating
    const { risks } = explainMatch(vehicle, baseBuyer, { ...perfectBreakdown, equipment: 50 })
    expect(risks.some((r) => r.includes('calefacción'))).toBe(true)
  })

  it('fuera de zona → riesgo con ubicación', () => {
    const vehicle = { ...baseVehicle, location: 'Madrid' }
    const { risks } = explainMatch(vehicle, baseBuyer, { ...perfectBreakdown, zone: 0 })
    expect(risks.some((r) => r.includes('Madrid') && r.includes('Barcelona'))).toBe(true)
  })

  it('km/antigüedad elevados → riesgo', () => {
    const vehicle = { ...baseVehicle, year: 2008, km: 180000 }
    const { risks } = explainMatch(vehicle, baseBuyer, { ...perfectBreakdown, ageKm: 20 })
    expect(risks.some((r) => r.includes('Antigüedad'))).toBe(true)
  })

  it('categoría sin etiquetar → aviso de confirmar', () => {
    const { risks } = explainMatch(baseVehicle, baseBuyer, { ...perfectBreakdown, category: 60 })
    expect(risks.some((r) => r.includes('sin etiquetar'))).toBe(true)
  })
})

describe('explainMatch — sin preferencias', () => {
  it('comprador sin criterios → sin motivos ni riesgos de esos ejes', () => {
    const buyer: MatchingBuyerInput = {
      ...baseBuyer,
      preferredCategory: null,
      preferredBedLayout: null,
      criticalEquipment: {},
      maxBudget: null,
      useZone: null,
    }
    const { reasons, risks } = explainMatch(baseVehicle, buyer, {
      category: 100,
      bedLayout: 100,
      equipment: 100,
      price: 100,
      ageKm: 90,
      zone: 100,
    })
    // Solo queda el motivo de antigüedad/km (no depende de preferencias)
    expect(reasons.some((r) => r.includes('Pocos km'))).toBe(true)
    expect(reasons.some((r) => r.includes('Distribución'))).toBe(false)
    expect(risks).toHaveLength(0)
  })
})
