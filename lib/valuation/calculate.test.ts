import { describe, expect, it, vi } from 'vitest'
import { calculateValuation } from './calculate'
import type {
  ComparableSale,
  ReferencePriceData,
  ValuationDeps,
  ValuationVehicleInput,
} from './types'

const baseInput: ValuationVehicleInput = {
  brand: 'Volkswagen',
  model: 'California Ocean',
  type: 'CAMPER',
  year: 2020,
  km: 60000,
  conservationState: 'BUENO',
  equipment: { kitchen: true },
}

function deps(opts: {
  comparables?: ComparableSale[]
  reference?: ReferencePriceData | null
}): ValuationDeps {
  return {
    findComparables: vi.fn().mockResolvedValue(opts.comparables ?? []),
    findReferencePrice: vi.fn().mockResolvedValue(opts.reference ?? null),
  }
}

describe('calculateValuation — comparables', () => {
  it('usa mediana/p25/p75 cuando hay ≥3 comparables', async () => {
    const comparables: ComparableSale[] = [
      { id: '1', year: 2020, km: 55000, price: 50000 },
      { id: '2', year: 2019, km: 60000, price: 52000 },
      { id: '3', year: 2021, km: 65000, price: 54000 },
      { id: '4', year: 2020, km: 58000, price: 56000 },
      { id: '5', year: 2020, km: 62000, price: 58000 },
    ]
    const result = await calculateValuation(baseInput, deps({ comparables }))

    expect(result.method).toBe('COMPARABLES')
    expect(result.confidence).toBe('ALTA') // ≥5 comparables
    expect(result.parameters.comparablesCount).toBe(5)
    // [50000, 52000, 54000, 56000, 58000] — quantil tipo-7: p25=52k, p50=54k, p75=56k
    // Sin ajuste por conservación BUENO ni equipamiento premium
    expect(result.min).toBe(52000)
    expect(result.recommended).toBe(54000)
    expect(result.max).toBe(56000)
  })

  it('confidence MEDIA con 3 o 4 comparables', async () => {
    const comparables: ComparableSale[] = [
      { id: '1', year: 2020, km: 55000, price: 50000 },
      { id: '2', year: 2019, km: 60000, price: 52000 },
      { id: '3', year: 2021, km: 65000, price: 54000 },
    ]
    const result = await calculateValuation(baseInput, deps({ comparables }))
    expect(result.method).toBe('COMPARABLES')
    expect(result.confidence).toBe('MEDIA')
  })

  it('cae a referencia con <3 comparables', async () => {
    const comparables: ComparableSale[] = [{ id: '1', year: 2020, km: 55000, price: 50000 }]
    const reference: ReferencePriceData = {
      brand: 'Volkswagen',
      model: 'California Ocean',
      type: 'CAMPER',
      baseYear: 2020,
      basePrice: 65000,
      depreciationPerKm: 0.18,
    }
    const result = await calculateValuation(baseInput, deps({ comparables, reference }))
    expect(result.method).toBe('REFERENCIA')
    expect(result.parameters.comparablesCount).toBe(1)
  })
})

describe('calculateValuation — referencia', () => {
  const reference: ReferencePriceData = {
    brand: 'Volkswagen',
    model: 'California Ocean',
    type: 'CAMPER',
    baseYear: 2020,
    basePrice: 65000,
    depreciationPerKm: 0.18,
  }

  it('aplica depreciación por km y rango ±15%', async () => {
    const result = await calculateValuation(baseInput, deps({ reference }))
    // basePrice 65000 - 60000*0.18 = 65000 - 10800 = 54200
    // min: 54200 * 0.85 = 46070 → redondea a 46100
    // max: 54200 * 1.15 = 62330 → redondea a 62300
    expect(result.method).toBe('REFERENCIA')
    expect(result.recommended).toBe(54200)
    expect(result.min).toBe(46100)
    expect(result.max).toBe(62300)
    expect(result.confidence).toBe('MEDIA') // mismo año que baseYear
  })

  it('confidence BAJA si el año del vehículo dista >1 del baseYear', async () => {
    const input = { ...baseInput, year: 2017 }
    const result = await calculateValuation(input, deps({ reference }))
    expect(result.confidence).toBe('BAJA')
  })

  it('aplica yearFactor cuando el vehículo es más viejo que baseYear', async () => {
    const input = { ...baseInput, year: 2018, km: 0 }
    const result = await calculateValuation(input, deps({ reference }))
    // 65000 * 0.92^2 = 65000 * 0.8464 = 55016
    expect(result.recommended).toBe(55000)
  })

  it('no devuelve precio negativo si los km exceden la depreciación', async () => {
    const input = { ...baseInput, km: 1_000_000 }
    const result = await calculateValuation(input, deps({ reference }))
    expect(result.recommended).toBe(0)
    expect(result.min).toBe(0)
    expect(result.max).toBe(0)
  })

  it('devuelve NONE si no hay comparables ni referencia', async () => {
    const result = await calculateValuation(baseInput, deps({}))
    expect(result.method).toBe('NONE')
    expect(result.confidence).toBe('BAJA')
    expect(result.recommended).toBe(0)
  })
})

describe('calculateValuation — ajustes finales', () => {
  const reference: ReferencePriceData = {
    brand: 'Adria',
    model: 'Twin',
    type: 'CAMPER',
    baseYear: 2020,
    basePrice: 50000,
    depreciationPerKm: 0,
  }

  it('estado DETERIORADO reduce el precio un 10%', async () => {
    const input: ValuationVehicleInput = {
      ...baseInput,
      brand: 'Adria',
      model: 'Twin',
      km: 0,
      conservationState: 'DETERIORADO',
      equipment: {},
    }
    const result = await calculateValuation(input, deps({ reference }))
    // 50000 * 0.9 = 45000
    expect(result.recommended).toBe(45000)
  })

  it('estado EXCELENTE sube el precio un 5%', async () => {
    const input: ValuationVehicleInput = {
      ...baseInput,
      brand: 'Adria',
      model: 'Twin',
      km: 0,
      conservationState: 'EXCELENTE',
      equipment: {},
    }
    const result = await calculateValuation(input, deps({ reference }))
    // 50000 * 1.05 = 52500
    expect(result.recommended).toBe(52500)
  })

  it('equipamiento premium completo añade +8%', async () => {
    const input: ValuationVehicleInput = {
      ...baseInput,
      brand: 'Adria',
      model: 'Twin',
      km: 0,
      conservationState: 'BUENO',
      equipment: { solar: true, bathroom: true, shower: true, heating: true, kitchen: true },
    }
    const result = await calculateValuation(input, deps({ reference }))
    // 50000 * 1.08 = 54000
    expect(result.recommended).toBe(54000)
  })

  it('ajustes se acumulan multiplicativamente sobre comparables', async () => {
    const comparables: ComparableSale[] = [
      { id: '1', year: 2020, km: 50000, price: 50000 },
      { id: '2', year: 2020, km: 50000, price: 50000 },
      { id: '3', year: 2020, km: 50000, price: 50000 },
    ]
    const input: ValuationVehicleInput = {
      ...baseInput,
      conservationState: 'EXCELENTE',
      equipment: { solar: true, heating: true },
    }
    const result = await calculateValuation(input, deps({ comparables }))
    // 50000 * 1.05 * 1.04 = 54600
    expect(result.recommended).toBe(54600)
  })

  it('parameters captura los inputs y factores aplicados', async () => {
    const result = await calculateValuation(baseInput, deps({ reference }))
    expect(result.parameters.input).toEqual(baseInput)
    expect(result.parameters.adjustments.conservationFactor).toBe(1)
    expect(result.parameters.adjustments.equipmentFactor).toBe(1)
    expect(result.parameters.reference).toEqual(reference)
  })
})
