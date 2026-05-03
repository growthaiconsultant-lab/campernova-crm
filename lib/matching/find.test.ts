import { describe, expect, it } from 'vitest'
import { passesHardFilters } from './filters'
import { findMatchesForBuyer, findMatchesForVehicle, scorePair } from './find'
import type { MatchingBuyerInput, MatchingDeps, MatchingVehicleInput } from './types'

const NOW_YEAR = 2026

function makeVehicle(overrides: Partial<MatchingVehicleInput> = {}): MatchingVehicleInput {
  return {
    id: 'v-base',
    type: 'CAMPER',
    seats: 4,
    year: 2022,
    km: 50_000,
    equipment: { solar: true, bathroom: true, heating: true, kitchen: true },
    location: 'Madrid',
    price: 30_000,
    ...overrides,
  }
}

function makeBuyer(overrides: Partial<MatchingBuyerInput> = {}): MatchingBuyerInput {
  return {
    id: 'b-base',
    vehicleType: 'CAMPER',
    minSeats: 4,
    maxBudget: 35_000,
    criticalEquipment: { solar: true, bathroom: true },
    useZone: 'Madrid',
    ...overrides,
  }
}

function makeDeps(vehicles: MatchingVehicleInput[], buyers: MatchingBuyerInput[]): MatchingDeps {
  return {
    getVehicle: async (id) => vehicles.find((v) => v.id === id) ?? null,
    getBuyer: async (id) => buyers.find((b) => b.id === id) ?? null,
    listEligibleVehicles: async () => vehicles,
    listEligibleBuyers: async () => buyers,
  }
}

describe('passesHardFilters', () => {
  it('match perfecto pasa', () => {
    expect(passesHardFilters(makeVehicle(), makeBuyer())).toBe(true)
  })

  it('comprador sin filtros pasa cualquier vehículo', () => {
    expect(
      passesHardFilters(
        makeVehicle({ price: null }),
        makeBuyer({ vehicleType: null, minSeats: null, maxBudget: null })
      )
    ).toBe(true)
  })

  it('falla si tipo no coincide', () => {
    expect(
      passesHardFilters(makeVehicle({ type: 'AUTOCARAVANA' }), makeBuyer({ vehicleType: 'CAMPER' }))
    ).toBe(false)
  })

  it('falla si plazas insuficientes', () => {
    expect(passesHardFilters(makeVehicle({ seats: 3 }), makeBuyer({ minSeats: 4 }))).toBe(false)
  })

  it('precio dentro del +10% pasa', () => {
    expect(
      passesHardFilters(makeVehicle({ price: 33_000 }), makeBuyer({ maxBudget: 30_000 }))
    ).toBe(true)
  })

  it('precio por encima del +10% falla', () => {
    expect(
      passesHardFilters(makeVehicle({ price: 34_000 }), makeBuyer({ maxBudget: 30_000 }))
    ).toBe(false)
  })

  it('vehículo sin precio cuando comprador exige presupuesto → falla', () => {
    expect(passesHardFilters(makeVehicle({ price: null }), makeBuyer({ maxBudget: 30_000 }))).toBe(
      false
    )
  })
})

describe('scorePair', () => {
  it('match perfecto da score alto (~100)', () => {
    const result = scorePair(makeVehicle(), makeBuyer(), NOW_YEAR)
    expect(result.score).toBeGreaterThanOrEqual(90)
    expect(result.breakdown.equipment).toBe(100)
    expect(result.breakdown.price).toBe(100)
    expect(result.breakdown.zone).toBe(100)
  })

  it('precio justo en el límite penaliza', () => {
    const result = scorePair(
      makeVehicle({ price: 33_000 }),
      makeBuyer({ maxBudget: 30_000 }),
      NOW_YEAR
    )
    expect(result.breakdown.price).toBe(0)
  })

  it('zona distinta penaliza el eje zona', () => {
    const result = scorePair(
      makeVehicle({ location: 'Barcelona' }),
      makeBuyer({ useZone: 'Madrid' }),
      NOW_YEAR
    )
    expect(result.breakdown.zone).toBe(0)
  })

  it('vehículo sin equipamiento crítico pedido → eje equipment a 0', () => {
    const result = scorePair(
      makeVehicle({ equipment: { kitchen: true } }),
      makeBuyer({ criticalEquipment: { solar: true, bathroom: true } }),
      NOW_YEAR
    )
    expect(result.breakdown.equipment).toBe(0)
  })

  it('score final pondera correctamente: equipment=100, price=100, ageKm=0, zone=0 → 65', () => {
    const result = scorePair(
      makeVehicle({ year: 2011, km: 200_000, location: 'Barcelona' }),
      makeBuyer(),
      NOW_YEAR
    )
    // 40*100/100 + 25*100/100 + 20*0/100 + 15*0/100 = 40 + 25 = 65
    expect(result.score).toBe(65)
  })
})

describe('findMatchesForVehicle', () => {
  it('devuelve [] si el vehículo no existe', async () => {
    const deps = makeDeps([], [makeBuyer()])
    expect(await findMatchesForVehicle('inexistente', deps, NOW_YEAR)).toEqual([])
  })

  it('descarta compradores que no pasan los filtros duros', async () => {
    const vehicle = makeVehicle()
    const buyers = [
      makeBuyer({ id: 'b-ok' }),
      makeBuyer({ id: 'b-tipo-mal', vehicleType: 'AUTOCARAVANA' }),
      makeBuyer({ id: 'b-plazas-mal', minSeats: 6 }),
      makeBuyer({ id: 'b-presupuesto-mal', maxBudget: 20_000 }),
    ]
    const deps = makeDeps([vehicle], buyers)

    const results = await findMatchesForVehicle('v-base', deps, NOW_YEAR)
    expect(results.map((m) => m.buyerLeadId)).toEqual(['b-ok'])
  })

  it('ordena por score descendente y limita a 10', async () => {
    const vehicle = makeVehicle()
    const buyers: MatchingBuyerInput[] = Array.from({ length: 15 }, (_, i) =>
      makeBuyer({
        id: `b-${i}`,
        // Cada buyer i tiene useZone distinto (algunos matchean Madrid, otros no)
        useZone: i < 5 ? 'Madrid' : 'Barcelona',
      })
    )
    const deps = makeDeps([vehicle], buyers)

    const results = await findMatchesForVehicle('v-base', deps, NOW_YEAR)
    expect(results).toHaveLength(10)
    // Top 5 deben ser los Madrid (score más alto)
    const top5Ids = results.slice(0, 5).map((m) => m.buyerLeadId)
    expect(top5Ids.sort()).toEqual(['b-0', 'b-1', 'b-2', 'b-3', 'b-4'])
    // Orden descendente
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score)
    }
  })
})

describe('findMatchesForBuyer', () => {
  it('devuelve [] si el comprador no existe', async () => {
    const deps = makeDeps([makeVehicle()], [])
    expect(await findMatchesForBuyer('inexistente', deps, NOW_YEAR)).toEqual([])
  })

  it('descarta vehículos que no pasan los filtros duros', async () => {
    const buyer = makeBuyer()
    const vehicles = [
      makeVehicle({ id: 'v-ok' }),
      makeVehicle({ id: 'v-tipo-mal', type: 'AUTOCARAVANA' }),
      makeVehicle({ id: 'v-plazas-mal', seats: 2 }),
      makeVehicle({ id: 'v-precio-mal', price: 50_000 }),
    ]
    const deps = makeDeps(vehicles, [buyer])

    const results = await findMatchesForBuyer('b-base', deps, NOW_YEAR)
    expect(results.map((m) => m.vehicleId)).toEqual(['v-ok'])
  })

  it('vehículo más nuevo y con menos km gana al más viejo', async () => {
    const buyer = makeBuyer()
    const vehicles = [
      makeVehicle({ id: 'v-viejo', year: 2014, km: 150_000 }),
      makeVehicle({ id: 'v-nuevo', year: 2025, km: 10_000 }),
    ]
    const deps = makeDeps(vehicles, [buyer])

    const results = await findMatchesForBuyer('b-base', deps, NOW_YEAR)
    expect(results[0].vehicleId).toBe('v-nuevo')
  })
})
