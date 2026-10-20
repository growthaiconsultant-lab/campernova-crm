import { describe, expect, it } from 'vitest'
import type { BuyerLeadStatus, SellerLeadStatus } from '@prisma/client'
import {
  BUYER_LEAD_TRANSITIONS,
  BUYER_LEAD_ACTIVE_STATUSES,
  BUYER_LEAD_STATUS_LABELS,
  SELLER_LEAD_TRANSITIONS,
  VEHICLE_TRANSITIONS,
  isValidTransition,
} from './state-machine'

describe('transiciones permisivas de leads', () => {
  it('Bajo pedido permanece activo y permite corregir su clasificación', () => {
    expect(BUYER_LEAD_STATUS_LABELS.BAJO_PEDIDO).toBe('Bajo pedido')
    expect(BUYER_LEAD_ACTIVE_STATUSES).toContain('BAJO_PEDIDO')
    expect(isValidTransition(BUYER_LEAD_TRANSITIONS, 'NUEVO', 'BAJO_PEDIDO')).toBe(true)
    expect(isValidTransition(BUYER_LEAD_TRANSITIONS, 'BAJO_PEDIDO', 'CONTACTADO')).toBe(true)
  })
  it('No contesta permanece activo y se puede corregir a Contactado', () => {
    expect(BUYER_LEAD_STATUS_LABELS.NO_CONTESTA).toBe('No contesta')
    expect(BUYER_LEAD_ACTIVE_STATUSES).toContain('NO_CONTESTA')
    expect(isValidTransition(BUYER_LEAD_TRANSITIONS, 'NUEVO', 'NO_CONTESTA')).toBe(true)
    expect(isValidTransition(BUYER_LEAD_TRANSITIONS, 'NO_CONTESTA', 'CONTACTADO')).toBe(true)
    expect(isValidTransition(BUYER_LEAD_TRANSITIONS, 'NO_CONTESTA', 'NUEVO')).toBe(true)
  })
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
