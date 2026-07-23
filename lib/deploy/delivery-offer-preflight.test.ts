import { describe, it, expect } from 'vitest'
import {
  evaluateDeliveryOfferPreflight,
  type DeliveryOfferChecks,
} from './delivery-offer-preflight'

/** Estado "todo correcto" para el PREFLIGHT (pre-contract): expand aplicado, offer_id nullable. */
function healthyPreflight(): DeliveryOfferChecks {
  return {
    nullOfferIds: 0,
    orphans: 0,
    incoherent: 0,
    dupActive: 0,
    failedMigrations: 0,
    tableExists: true,
    offerIdColumnExists: true,
    offerIdIsNullable: true,
    offerIdType: 'text',
    offerIdHasDefault: false,
    fkPresentValid: true,
    fkOnDeleteNoAction: true,
    fkOnUpdateCascade: true,
    normalIndexPresent: true,
    partialIndexPresent: true,
    partialIndexUnique: true,
    partialIndexPredicateOk: true,
    i3c1aApplied: true,
    i3c1bApplied: false,
    expectNullable: true,
  }
}

describe('evaluateDeliveryOfferPreflight — contrato de salida (§13)', () => {
  it('todo correcto (preflight) → code 0, sin fallos', () => {
    const v = evaluateDeliveryOfferPreflight(healthyPreflight())
    expect(v.code).toBe(0)
    expect(v.failed).toEqual([])
  })

  it('postflight sano (offer_id NOT NULL, I3C1B aplicada) → code 0', () => {
    const v = evaluateDeliveryOfferPreflight({
      ...healthyPreflight(),
      offerIdIsNullable: false,
      i3c1bApplied: true,
      expectNullable: false,
    })
    expect(v.code).toBe(0)
    expect(v.failed).toEqual([])
  })

  // Cada anomalía debe dar code 1. Se parte del estado sano y se altera un único campo.
  const anomalies: Array<[string, Partial<DeliveryOfferChecks>]> = [
    ['offer_id null', { nullOfferIds: 1 }],
    ['huérfanas', { orphans: 1 }],
    ['mismatch Offer↔Delivery', { incoherent: 1 }],
    ['duplicado activo', { dupActive: 1 }],
    ['migración fallida activa', { failedMigrations: 1 }],
    ['tabla ausente', { tableExists: false }],
    ['columna ausente', { offerIdColumnExists: false }],
    ['nullability inesperada (pre-contract)', { offerIdIsNullable: false }],
    ['I3C1B ya aplicada (pre-contract)', { i3c1bApplied: true }],
    ['tipo != text', { offerIdType: 'varchar' }],
    ['default presente', { offerIdHasDefault: true }],
    ['FK ausente/inválida', { fkPresentValid: false }],
    ['FK delete != NO ACTION', { fkOnDeleteNoAction: false }],
    ['FK update != CASCADE', { fkOnUpdateCascade: false }],
    ['índice normal ausente', { normalIndexPresent: false }],
    ['índice parcial ausente', { partialIndexPresent: false }],
    ['índice parcial no unique', { partialIndexUnique: false }],
    ['predicado parcial inesperado', { partialIndexPredicateOk: false }],
    ['I3C1A no aplicada', { i3c1aApplied: false }],
  ]

  it.each(anomalies)('anomalía "%s" → code 1', (_label, patch) => {
    const v = evaluateDeliveryOfferPreflight({ ...healthyPreflight(), ...patch })
    expect(v.code).toBe(1)
    expect(v.failed.length).toBeGreaterThan(0)
  })

  it('postflight con offer_id todavía nullable → code 1', () => {
    const v = evaluateDeliveryOfferPreflight({
      ...healthyPreflight(),
      expectNullable: false,
      offerIdIsNullable: true,
      i3c1bApplied: false,
    })
    expect(v.code).toBe(1)
    expect(v.failed).toContain('offer_id sigue nullable (post-contract)')
    expect(v.failed).toContain('I3C1B no aplicada (post-contract)')
  })
})
