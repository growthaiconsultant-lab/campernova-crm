import { describe, expect, it } from 'vitest'
import type { BuyerLeadStatus, SellerLeadStatus } from '@prisma/client'
import {
  BUYER_LEAD_TRANSITIONS,
  SELLER_LEAD_TRANSITIONS,
  VEHICLE_TRANSITIONS,
  isValidTransition,
} from './state-machine'

describe('transiciones permisivas de leads', () => {
  it('permite un salto no secuencial y la vuelta atrás en vendedores', () => {
    expect(isValidTransition(SELLER_LEAD_TRANSITIONS, 'NUEVO', 'EN_NEGOCIACION')).toBe(true)
    expect(isValidTransition(SELLER_LEAD_TRANSITIONS, 'CERRADO', 'CONTACTADO')).toBe(true)
  })

  it('ofrece cualquier destino distinto al actual para cada estado de vendedor', () => {
    const statuses = Object.keys(SELLER_LEAD_TRANSITIONS) as SellerLeadStatus[]
    for (const from of statuses) {
      expect(SELLER_LEAD_TRANSITIONS[from]).toEqual(statuses.filter((to) => to !== from))
    }
  })

  it('permite saltos libres en compradores, incluido CERRADO como destino sujeto al guard', () => {
    expect(isValidTransition(BUYER_LEAD_TRANSITIONS, 'NUEVO', 'EN_NEGOCIACION')).toBe(true)
    expect(isValidTransition(BUYER_LEAD_TRANSITIONS, 'NUEVO', 'CERRADO')).toBe(true)
    expect(isValidTransition(BUYER_LEAD_TRANSITIONS, 'CERRADO', 'PERDIDO')).toBe(true)
  })

  it('ofrece cualquier destino distinto al actual para cada estado de comprador', () => {
    const statuses = Object.keys(BUYER_LEAD_TRANSITIONS) as BuyerLeadStatus[]
    for (const from of statuses) {
      expect(BUYER_LEAD_TRANSITIONS[from]).toEqual(statuses.filter((to) => to !== from))
    }
  })

  it('no relaja la máquina de estados del vehículo', () => {
    expect(VEHICLE_TRANSITIONS).toEqual({ NUEVO: [], TASADO: ['PUBLICADO'] })
  })
})
