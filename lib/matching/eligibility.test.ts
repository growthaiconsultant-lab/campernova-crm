import { describe, expect, it } from 'vitest'
import type { VehicleStatus } from '@prisma/client'
import {
  ELIGIBLE_VEHICLE_STATUSES,
  INELIGIBLE_BUYER_STATUSES,
  eligibleBuyerWhere,
  eligibleMatchWhere,
  eligibleVehicleWhere,
  isBuyerEligible,
  isVehicleEligible,
} from './eligibility'

const ENTRY = new Date('2026-07-01T10:00:00Z')

/** Vehículo con entrada oficial activa por defecto (validada, no anulada). */
function vehicle(
  status: VehicleStatus,
  overrides: Partial<{
    sellerArchivedAt: Date | null
    entryValidatedAt: Date | null
    entryAnnulledAt: Date | null
  }> = {}
) {
  return {
    status,
    sellerArchivedAt: null,
    entryValidatedAt: ENTRY,
    entryAnnulledAt: null,
    ...overrides,
  }
}

describe('isVehicleEligible', () => {
  it('NUEVO → no elegible', () => {
    expect(isVehicleEligible(vehicle('NUEVO'))).toBe(false)
  })

  it('TASADO con vendedor no archivado + entrada activa → elegible', () => {
    expect(isVehicleEligible(vehicle('TASADO'))).toBe(true)
  })

  it('PUBLICADO con vendedor no archivado + entrada activa → elegible', () => {
    expect(isVehicleEligible(vehicle('PUBLICADO'))).toBe(true)
  })

  it('RESERVADO / VENDIDO / DESCARTADO → no elegibles', () => {
    expect(isVehicleEligible(vehicle('RESERVADO'))).toBe(false)
    expect(isVehicleEligible(vehicle('VENDIDO'))).toBe(false)
    expect(isVehicleEligible(vehicle('DESCARTADO'))).toBe(false)
  })

  it('vendedor archivado → no elegible aunque el estado sea comercializable', () => {
    expect(isVehicleEligible(vehicle('PUBLICADO', { sellerArchivedAt: new Date() }))).toBe(false)
    expect(isVehicleEligible(vehicle('TASADO', { sellerArchivedAt: new Date() }))).toBe(false)
  })

  it('entrada NO validada → no elegible aunque el estado y el vendedor sean válidos (A2)', () => {
    expect(isVehicleEligible(vehicle('PUBLICADO', { entryValidatedAt: null }))).toBe(false)
    expect(isVehicleEligible(vehicle('TASADO', { entryValidatedAt: null }))).toBe(false)
  })

  it('entrada ANULADA → no elegible aunque estuviera validada (A2)', () => {
    expect(isVehicleEligible(vehicle('PUBLICADO', { entryAnnulledAt: new Date() }))).toBe(false)
    expect(isVehicleEligible(vehicle('TASADO', { entryAnnulledAt: new Date() }))).toBe(false)
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
  it('eligibleVehicleWhere filtra por estado + vendedor no archivado + entrada activa', () => {
    expect(eligibleVehicleWhere).toEqual({
      status: { in: [...ELIGIBLE_VEHICLE_STATUSES] },
      sellerLead: { archivedAt: null },
      entryValidatedAt: { not: null },
      entryAnnulledAt: null,
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
