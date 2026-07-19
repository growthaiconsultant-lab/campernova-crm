import { describe, it, expect } from 'vitest'
import {
  ARCHIVE_REASON_LABELS,
  ARCHIVE_REASON_OPTIONS,
  ACTIVE_OFFER_STATUSES,
  ACTIVE_DELIVERY_STATUSES,
  BLOCKING_VEHICLE_STATUSES,
  classifyBlockers,
  isValidArchiveReason,
  normalizeArchiveNotes,
} from './domain'
import type { ArchiveDependencyInput } from './types'

const NONE: ArchiveDependencyInput = {
  vehicleStatus: null,
  activeOfferCount: 0,
  activeReservationCount: 0,
  activeDeliveryCount: 0,
  hasPendingNextAction: false,
  futureEventCount: 0,
}

describe('motivos de archivado', () => {
  it('los 6 motivos tienen etiqueta y opciones', () => {
    expect(Object.keys(ARCHIVE_REASON_LABELS)).toEqual([
      'SIN_RESPUESTA',
      'FUERA_DE_MERCADO',
      'POSIBLE_DUPLICADO',
      'PRUEBA_INTERNA',
      'LIMPIEZA_BANDEJA',
      'OTRO',
    ])
    expect(ARCHIVE_REASON_OPTIONS).toHaveLength(6)
  })

  it('valida el motivo', () => {
    expect(isValidArchiveReason('SIN_RESPUESTA')).toBe(true)
    expect(isValidArchiveReason('INVENTADO')).toBe(false)
    expect(isValidArchiveReason(undefined)).toBe(false)
    expect(isValidArchiveReason(null)).toBe(false)
    // No se admite un motivo de pérdida COMERCIAL como motivo de archivado.
    expect(isValidArchiveReason('PRECIO')).toBe(false)
  })
})

describe('normalizeArchiveNotes', () => {
  it('trim, vacío → null, máximo 500', () => {
    expect(normalizeArchiveNotes('  hola  ')).toBe('hola')
    expect(normalizeArchiveNotes('   ')).toBeNull()
    expect(normalizeArchiveNotes('')).toBeNull()
    expect(normalizeArchiveNotes(null)).toBeNull()
    expect(normalizeArchiveNotes(undefined)).toBeNull()
    expect(normalizeArchiveNotes('x'.repeat(600))).toHaveLength(500)
  })
})

describe('constantes derivadas del dominio', () => {
  it('las ofertas vivas se derivan de isActiveHold (no se redefinen)', () => {
    expect(ACTIVE_OFFER_STATUSES.slice().sort()).toEqual(
      ['ACEPTADA', 'CONTRAOFERTA', 'PROPUESTA'].sort()
    )
    // Los estados cerrados NO cuentan como oferta viva.
    for (const closed of ['CONVERTIDA', 'RECHAZADA', 'EXPIRADA', 'RETIRADA', 'CANCELADA']) {
      expect(ACTIVE_OFFER_STATUSES).not.toContain(closed)
    }
  })

  it('entregas activas = PROGRAMADA / EN_CURSO', () => {
    expect(ACTIVE_DELIVERY_STATUSES).toEqual(['PROGRAMADA', 'EN_CURSO'])
    expect(ACTIVE_DELIVERY_STATUSES).not.toContain('COMPLETADA')
    expect(ACTIVE_DELIVERY_STATUSES).not.toContain('CANCELADA')
  })

  it('vehículo en comercialización = stock real; terminales y NUEVO no bloquean', () => {
    expect(BLOCKING_VEHICLE_STATUSES).toEqual(['TASADO', 'PUBLICADO', 'RESERVADO'])
    expect(BLOCKING_VEHICLE_STATUSES).not.toContain('VENDIDO')
    expect(BLOCKING_VEHICLE_STATUSES).not.toContain('DESCARTADO')
    expect(BLOCKING_VEHICLE_STATUSES).not.toContain('NUEVO')
  })
})

describe('classifyBlockers', () => {
  it('sin dependencias → se puede archivar', () => {
    expect(classifyBlockers(NONE)).toEqual([])
  })

  it.each(['TASADO', 'PUBLICADO', 'RESERVADO'])('vehículo %s bloquea', (status) => {
    const b = classifyBlockers({ ...NONE, vehicleStatus: status })
    expect(b).toHaveLength(1)
    expect(b[0].type).toBe('VEHICLE_IN_STOCK')
    expect(b[0].count).toBe(1)
  })

  it.each(['NUEVO', 'VENDIDO', 'DESCARTADO'])('vehículo %s NO bloquea', (status) => {
    expect(classifyBlockers({ ...NONE, vehicleStatus: status })).toEqual([])
  })

  it('oferta viva bloquea', () => {
    const b = classifyBlockers({ ...NONE, activeOfferCount: 2 })
    expect(b).toHaveLength(1)
    expect(b[0]).toMatchObject({ type: 'ACTIVE_OFFER', count: 2 })
  })

  it('reserva con señal bloquea y no se cuenta dos veces como oferta', () => {
    // 1 oferta viva que ES la reserva → un único bloqueo de tipo reserva.
    const b = classifyBlockers({ ...NONE, activeOfferCount: 1, activeReservationCount: 1 })
    expect(b).toHaveLength(1)
    expect(b[0]).toMatchObject({ type: 'ACTIVE_RESERVATION', count: 1 })
  })

  it('reserva + oferta adicional → dos bloqueos con conteos correctos', () => {
    const b = classifyBlockers({ ...NONE, activeOfferCount: 3, activeReservationCount: 1 })
    expect(b.map((x) => [x.type, x.count])).toEqual([
      ['ACTIVE_RESERVATION', 1],
      ['ACTIVE_OFFER', 2],
    ])
  })

  it('entrega activa bloquea', () => {
    const b = classifyBlockers({ ...NONE, activeDeliveryCount: 1 })
    expect(b[0]).toMatchObject({ type: 'ACTIVE_DELIVERY', count: 1 })
  })

  it('próxima acción pendiente bloquea (también si está vencida)', () => {
    const b = classifyBlockers({ ...NONE, hasPendingNextAction: true })
    expect(b[0]).toMatchObject({ type: 'PENDING_NEXT_ACTION', count: 1 })
    expect(b[0].message).toMatch(/vencidas/i)
  })

  it('evento futuro bloquea', () => {
    const b = classifyBlockers({ ...NONE, futureEventCount: 2 })
    expect(b[0]).toMatchObject({ type: 'FUTURE_EVENT', count: 2 })
  })

  it('varios bloqueos a la vez se acumulan', () => {
    const b = classifyBlockers({
      vehicleStatus: 'PUBLICADO',
      activeOfferCount: 1,
      activeReservationCount: 0,
      activeDeliveryCount: 1,
      hasPendingNextAction: true,
      futureEventCount: 1,
    })
    expect(b.map((x) => x.type)).toEqual([
      'VEHICLE_IN_STOCK',
      'ACTIVE_OFFER',
      'ACTIVE_DELIVERY',
      'PENDING_NEXT_ACTION',
      'FUTURE_EVENT',
    ])
  })

  it('los bloqueos no contienen PII (solo tipo, cantidad y mensaje genérico)', () => {
    const b = classifyBlockers({
      vehicleStatus: 'PUBLICADO',
      activeOfferCount: 1,
      activeReservationCount: 1,
      activeDeliveryCount: 1,
      hasPendingNextAction: true,
      futureEventCount: 1,
    })
    const serialized = JSON.stringify(b)
    expect(serialized).not.toMatch(/@/) // sin emails
    expect(serialized).not.toMatch(/\b\d{9}\b/) // sin teléfonos
    expect(serialized).not.toMatch(/postgres|http/i)
    for (const x of b) {
      expect(Object.keys(x).sort()).toEqual(['count', 'message', 'type'])
    }
  })
})
