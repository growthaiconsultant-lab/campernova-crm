import { describe, it, expect } from 'vitest'
import { resultToOutcome, referenceUsedLabel, validateManualValuation } from './outcome'
import type { ValuationOutput } from './types'

function output(over: Partial<ValuationOutput> = {}): ValuationOutput {
  return {
    min: 10000,
    recommended: 12000,
    max: 14000,
    method: 'COMPARABLES',
    confidence: 'ALTA',
    parameters: {
      input: {
        brand: 'Adria',
        model: 'Coral',
        type: 'AUTOCARAVANA',
        year: 2020,
        km: 1000,
        conservationState: 'BUENO',
        equipment: {},
      },
      method: 'COMPARABLES',
      comparablesCount: 5,
      adjustments: { conservationFactor: 1, equipmentFactor: 1 },
    },
    ...over,
  }
}

describe('resultToOutcome', () => {
  it('COMPARABLES/REFERENCIA con cifras → COMPLETADA', () => {
    expect(resultToOutcome(output({ method: 'COMPARABLES' }))).toBe('COMPLETADA')
    expect(resultToOutcome(output({ method: 'REFERENCIA' }))).toBe('COMPLETADA')
  })

  it('NONE (sin datos) → SIN_REFERENCIA', () => {
    expect(resultToOutcome(output({ method: 'NONE' }))).toBe('SIN_REFERENCIA')
  })
})

describe('referenceUsedLabel', () => {
  it('COMPARABLES incluye el nº de ventas', () => {
    const r = output({
      parameters: { ...output().parameters, method: 'COMPARABLES', comparablesCount: 7 },
    })
    expect(referenceUsedLabel(r)).toBe('COMPARABLES · 7 ventas')
  })

  it('REFERENCIA incluye marca/modelo/base', () => {
    const r = output({
      parameters: {
        ...output().parameters,
        method: 'REFERENCIA',
        reference: {
          brand: 'Adria',
          model: 'Coral',
          type: 'AUTOCARAVANA',
          baseYear: 2018,
          basePrice: 30000,
          depreciationPerKm: 0.05,
        },
      },
    })
    expect(referenceUsedLabel(r)).toBe('REFERENCIA · Adria Coral (base 2018)')
  })

  it('NONE → null', () => {
    const r = output({ parameters: { ...output().parameters, method: 'NONE' } })
    expect(referenceUsedLabel(r)).toBeNull()
  })
})

describe('validateManualValuation', () => {
  const base = {
    min: 10000,
    recommended: 12000,
    max: 14000,
    confidence: 'MEDIA' as const,
    reason: 'Revisión con el mecánico',
  }

  it('acepta un rango válido con confianza declarada y motivo', () => {
    expect(validateManualValuation(base)).toBeNull()
  })

  it('rechaza min > recommended', () => {
    expect(validateManualValuation({ ...base, min: 13000 })).toBe('INVALID_RANGE')
  })

  it('rechaza recommended > max', () => {
    expect(validateManualValuation({ ...base, recommended: 15000 })).toBe('INVALID_RANGE')
  })

  it('rechaza dinero negativo', () => {
    expect(validateManualValuation({ ...base, min: -1 })).toBe('NEGATIVE_MONEY')
  })

  it('acepta rango degenerado min = recommended = max (dinero no negativo)', () => {
    expect(
      validateManualValuation({ ...base, min: 12000, recommended: 12000, max: 12000 })
    ).toBeNull()
  })

  it('rechaza motivo vacío (no se infiere ALTA ni motivo)', () => {
    expect(validateManualValuation({ ...base, reason: '   ' })).toBe('REASON_REQUIRED')
  })

  it('rechaza confianza inválida', () => {
    expect(validateManualValuation({ ...base, confidence: 'SUPER' as unknown as 'ALTA' })).toBe(
      'CONFIDENCE_REQUIRED'
    )
  })
})
