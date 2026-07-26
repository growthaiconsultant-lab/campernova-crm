import { describe, expect, it } from 'vitest'
import type { CategoryDocSignal } from './checklist'
import {
  areCategoriesClassified,
  deriveCategoryState,
  deriveDocumentChecklist,
  isContratoGestionSatisfied,
} from './checklist'

function signal(
  category: CategoryDocSignal['category'],
  overrides: Partial<Omit<CategoryDocSignal, 'category'>> = {}
): CategoryDocSignal {
  return { category, hasActiveVersion: false, disposition: null, ...overrides }
}

describe('deriveCategoryState', () => {
  it('documento con versión ACTIVE → RECIBIDO (aunque haya disposición)', () => {
    expect(
      deriveCategoryState(
        signal('DNI_VENDEDOR', { hasActiveVersion: true, disposition: 'NO_DISPONIBLE' })
      )
    ).toBe('RECIBIDO')
  })

  it('sin documento + disposición registrada → valor de la disposición', () => {
    expect(deriveCategoryState(signal('DNI_VENDEDOR', { disposition: 'NO_DISPONIBLE' }))).toBe(
      'NO_DISPONIBLE'
    )
    expect(deriveCategoryState(signal('DNI_VENDEDOR', { disposition: 'NO_APLICABLE' }))).toBe(
      'NO_APLICABLE'
    )
    expect(deriveCategoryState(signal('DNI_VENDEDOR', { disposition: 'PENDIENTE' }))).toBe(
      'PENDIENTE'
    )
  })

  it('sin documento + sin disposición → SIN_CLASIFICAR', () => {
    expect(deriveCategoryState(signal('DNI_VENDEDOR'))).toBe('SIN_CLASIFICAR')
  })
})

describe('deriveDocumentChecklist', () => {
  it('deriva una fila por categoría', () => {
    const rows = deriveDocumentChecklist({
      signals: [
        signal('CONTRATO_GESTION', { hasActiveVersion: true }),
        signal('DNI_VENDEDOR', { disposition: 'NO_APLICABLE' }),
        signal('FICHA_TECNICA'),
      ],
    })
    expect(rows).toEqual([
      { category: 'CONTRATO_GESTION', state: 'RECIBIDO' },
      { category: 'DNI_VENDEDOR', state: 'NO_APLICABLE' },
      { category: 'FICHA_TECNICA', state: 'SIN_CLASIFICAR' },
    ])
  })
})

describe('isContratoGestionSatisfied — CONTRATO_GESTION nunca se satisface con una disposición', () => {
  it('con documento vigente → satisfecho', () => {
    expect(
      isContratoGestionSatisfied([signal('CONTRATO_GESTION', { hasActiveVersion: true })])
    ).toBe(true)
  })

  it('disposición NO_DISPONIBLE / NO_APLICABLE NO cuenta como satisfecho', () => {
    expect(
      isContratoGestionSatisfied([signal('CONTRATO_GESTION', { disposition: 'NO_DISPONIBLE' })])
    ).toBe(false)
    expect(
      isContratoGestionSatisfied([signal('CONTRATO_GESTION', { disposition: 'NO_APLICABLE' })])
    ).toBe(false)
  })

  it('sin señal de contrato → no satisfecho', () => {
    expect(isContratoGestionSatisfied([signal('DNI_VENDEDOR', { hasActiveVersion: true })])).toBe(
      false
    )
  })
})

describe('areCategoriesClassified', () => {
  const required = ['DNI_VENDEDOR', 'FICHA_TECNICA'] as const

  it('todas con documento o disposición → clasificadas', () => {
    expect(
      areCategoriesClassified(
        [
          signal('DNI_VENDEDOR', { hasActiveVersion: true }),
          signal('FICHA_TECNICA', { disposition: 'NO_APLICABLE' }),
        ],
        required
      )
    ).toBe(true)
  })

  it('una SIN_CLASIFICAR → no clasificadas', () => {
    expect(
      areCategoriesClassified(
        [signal('DNI_VENDEDOR', { hasActiveVersion: true }), signal('FICHA_TECNICA')],
        required
      )
    ).toBe(false)
  })

  it('una categoría requerida ausente de las señales → no clasificadas', () => {
    expect(
      areCategoriesClassified([signal('DNI_VENDEDOR', { hasActiveVersion: true })], required)
    ).toBe(false)
  })
})
