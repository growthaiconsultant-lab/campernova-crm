import { describe, expect, it } from 'vitest'
import {
  ELIGIBLE_VEHICLE_STATUSES,
  INELIGIBLE_BUYER_STATUSES,
  eligibleBuyerWhere,
  eligibleMatchWhere,
  eligibleVehicleWhere,
  isBuyerEligible,
  isVehicleEligible,
} from './eligibility'

describe('isVehicleEligible', () => {
  it('NUEVO → no elegible', () => {
    expect(isVehicleEligible({ status: 'NUEVO', sellerArchivedAt: null })).toBe(false)
  })

  it('TASADO con vendedor no archivado → elegible', () => {
    expect(isVehicleEligible({ status: 'TASADO', sellerArchivedAt: null })).toBe(true)
  })

  it('PUBLICADO con vendedor no archivado → elegible', () => {
    expect(isVehicleEligible({ status: 'PUBLICADO', sellerArchivedAt: null })).toBe(true)
  })

  it('RESERVADO / VENDIDO / DESCARTADO → no elegibles', () => {
    expect(isVehicleEligible({ status: 'RESERVADO', sellerArchivedAt: null })).toBe(false)
    expect(isVehicleEligible({ status: 'VENDIDO', sellerArchivedAt: null })).toBe(false)
    expect(isVehicleEligible({ status: 'DESCARTADO', sellerArchivedAt: null })).toBe(false)
  })

  it('vendedor archivado → no elegible aunque el estado sea comercializable', () => {
    expect(isVehicleEligible({ status: 'PUBLICADO', sellerArchivedAt: new Date() })).toBe(false)
    expect(isVehicleEligible({ status: 'TASADO', sellerArchivedAt: new Date() })).toBe(false)
  })
})

describe('isBuyerEligible', () => {
  it('NUEVO / CONTACTADO / CUALIFICADO / EN_NEGOCIACION → elegibles', () => {
    for (const status of ['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION'] as const) {
      expect(isBuyerEligible({ status, archivedAt: null })).toBe(true)
    }
  })

  it('CERRADO / PERDIDO → no elegibles', () => {
    expect(isBuyerEligible({ status: 'CERRADO', archivedAt: null })).toBe(false)
    expect(isBuyerEligible({ status: 'PERDIDO', archivedAt: null })).toBe(false)
  })

  it('comprador archivado → no elegible aunque el estado sea activo', () => {
    expect(isBuyerEligible({ status: 'CUALIFICADO', archivedAt: new Date() })).toBe(false)
  })
})

describe('fragmentos where (misma política)', () => {
  it('eligibleVehicleWhere filtra por estado comercializable + vendedor no archivado', () => {
    expect(eligibleVehicleWhere).toEqual({
      status: { in: [...ELIGIBLE_VEHICLE_STATUSES] },
      sellerLead: { archivedAt: null },
    })
  })

  it('eligibleBuyerWhere filtra por estado no terminal + no archivado', () => {
    expect(eligibleBuyerWhere).toEqual({
      status: { notIn: [...INELIGIBLE_BUYER_STATUSES] },
      archivedAt: null,
    })
  })

  it('eligibleMatchWhere exige ambas contrapartes elegibles', () => {
    expect(eligibleMatchWhere).toEqual({
      vehicle: eligibleVehicleWhere,
      buyerLead: eligibleBuyerWhere,
    })
  })
})
