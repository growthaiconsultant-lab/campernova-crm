import { describe, it, expect } from 'vitest'
import { listMissingRequirements, isReadyForStatus, calculateCompletionPercent } from './validate'
import type { VehicleLegalInput, DocumentSummary } from './types'
import { PUBLICADO_REQUIRED_DOCS } from './requirements'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-11T12:00:00Z')

const minVehicle: VehicleLegalInput = {
  id: 'v-1',
  plate: null,
  vin: null,
  itvValidUntil: null,
  chargeCheckedAt: null,
  desiredPrice: null,
  purchasePrice: null,
  salePrice: null,
  photoCount: 0,
  workOrdersBlockingCount: 0,
}

const tasadoReadyVehicle: VehicleLegalInput = {
  ...minVehicle,
  plate: '1234-ABC',
  desiredPrice: 25000,
  photoCount: 1,
}

const allDocsPresent: DocumentSummary[] = PUBLICADO_REQUIRED_DOCS.map((cat) => ({
  category: cat,
  exists: true,
}))

const noDocs: DocumentSummary[] = PUBLICADO_REQUIRED_DOCS.map((cat) => ({
  category: cat,
  exists: false,
}))

const publicadoReadyVehicle: VehicleLegalInput = {
  id: 'v-1',
  plate: '1234-ABC',
  vin: 'WDB9634032R123456',
  itvValidUntil: new Date('2027-01-01'),
  chargeCheckedAt: NOW,
  desiredPrice: 25000,
  purchasePrice: 22000,
  salePrice: 28000,
  photoCount: 5,
  workOrdersBlockingCount: 0,
}

// ─── TASADO ───────────────────────────────────────────────────────────────────

describe('isReadyForStatus — TASADO', () => {
  it('pasa con plate + desiredPrice + 1 foto', () => {
    expect(isReadyForStatus(tasadoReadyVehicle, 'TASADO', noDocs, NOW)).toBe(true)
  })

  it('falla si falta matrícula', () => {
    expect(isReadyForStatus({ ...tasadoReadyVehicle, plate: null }, 'TASADO', noDocs, NOW)).toBe(
      false
    )
  })

  it('falla si falta desiredPrice', () => {
    expect(
      isReadyForStatus({ ...tasadoReadyVehicle, desiredPrice: null }, 'TASADO', noDocs, NOW)
    ).toBe(false)
  })

  it('falla si no hay fotos', () => {
    expect(isReadyForStatus({ ...tasadoReadyVehicle, photoCount: 0 }, 'TASADO', noDocs, NOW)).toBe(
      false
    )
  })

  it('no importan los documentos para TASADO', () => {
    expect(isReadyForStatus(tasadoReadyVehicle, 'TASADO', noDocs, NOW)).toBe(true)
  })
})

// ─── PUBLICADO ────────────────────────────────────────────────────────────────

describe('isReadyForStatus — PUBLICADO', () => {
  it('pasa cuando todo está completo', () => {
    expect(isReadyForStatus(publicadoReadyVehicle, 'PUBLICADO', allDocsPresent, NOW)).toBe(true)
  })

  it('falla si falta VIN', () => {
    expect(
      isReadyForStatus({ ...publicadoReadyVehicle, vin: null }, 'PUBLICADO', allDocsPresent, NOW)
    ).toBe(false)
  })

  it('falla si ITV vencida', () => {
    const pastItv = new Date('2025-01-01')
    expect(
      isReadyForStatus(
        { ...publicadoReadyVehicle, itvValidUntil: pastItv },
        'PUBLICADO',
        allDocsPresent,
        NOW
      )
    ).toBe(false)
  })

  it('warnings ITV < 60 días no bloquean (severity=warning)', () => {
    const nearItv = new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000)
    const missing = listMissingRequirements(
      { ...publicadoReadyVehicle, itvValidUntil: nearItv },
      'PUBLICADO',
      allDocsPresent,
      NOW
    )
    const itvEntry = missing.find((m) => m.field === 'itvValidUntil')
    expect(itvEntry?.severity).toBe('warning')
    // warning entries alone no bloquean isReadyForStatus
    expect(
      isReadyForStatus(
        { ...publicadoReadyVehicle, itvValidUntil: nearItv },
        'PUBLICADO',
        allDocsPresent,
        NOW
      )
    ).toBe(true)
  })

  it('falla si faltan documentos obligatorios', () => {
    expect(isReadyForStatus(publicadoReadyVehicle, 'PUBLICADO', noDocs, NOW)).toBe(false)
  })

  it('falla si hay órdenes de taller activas', () => {
    expect(
      isReadyForStatus(
        { ...publicadoReadyVehicle, workOrdersBlockingCount: 1 },
        'PUBLICADO',
        allDocsPresent,
        NOW
      )
    ).toBe(false)
  })

  it('falla si pack visual incompleto (< 5 fotos)', () => {
    expect(
      isReadyForStatus(
        { ...publicadoReadyVehicle, photoCount: 3 },
        'PUBLICADO',
        allDocsPresent,
        NOW
      )
    ).toBe(false)
  })

  it('falta purchasePrice bloquea', () => {
    expect(
      isReadyForStatus(
        { ...publicadoReadyVehicle, purchasePrice: null },
        'PUBLICADO',
        allDocsPresent,
        NOW
      )
    ).toBe(false)
  })
})

// ─── listMissingRequirements ──────────────────────────────────────────────────

describe('listMissingRequirements', () => {
  it('devuelve lista vacía cuando todo está OK (PUBLICADO)', () => {
    expect(
      listMissingRequirements(publicadoReadyVehicle, 'PUBLICADO', allDocsPresent, NOW)
    ).toHaveLength(0)
  })

  it('devuelve todos los campos faltantes para vehículo vacío (PUBLICADO)', () => {
    const missing = listMissingRequirements(minVehicle, 'PUBLICADO', noDocs, NOW)
    const fields = missing.map((m) => m.field)
    expect(fields).toContain('plate')
    expect(fields).toContain('vin')
    expect(fields).toContain('desiredPrice')
    expect(fields).toContain('purchasePrice')
    expect(fields).toContain('salePrice')
    expect(fields).toContain('itvValidUntil')
    expect(fields).toContain('chargeCheckedAt')
    expect(fields).toContain('photos')
  })

  it('incluye mensajes de documentos faltantes', () => {
    const missing = listMissingRequirements(publicadoReadyVehicle, 'PUBLICADO', noDocs, NOW)
    const docFields = missing.filter((m) => m.field.startsWith('doc_'))
    expect(docFields).toHaveLength(PUBLICADO_REQUIRED_DOCS.length)
  })

  it('incluye mensaje de órdenes de taller bloqueantes', () => {
    const missing = listMissingRequirements(
      { ...publicadoReadyVehicle, workOrdersBlockingCount: 2 },
      'PUBLICADO',
      allDocsPresent,
      NOW
    )
    const woEntry = missing.find((m) => m.field === 'workOrders')
    expect(woEntry?.message).toContain('2 orden')
  })
})

// ─── calculateCompletionPercent ───────────────────────────────────────────────

describe('calculateCompletionPercent', () => {
  it('0% cuando no hay nada', () => {
    expect(calculateCompletionPercent(minVehicle, noDocs)).toBe(0)
  })

  it('100% cuando todo está completo', () => {
    expect(calculateCompletionPercent(publicadoReadyVehicle, allDocsPresent)).toBe(100)
  })

  it('valor parcial con algunos campos cubiertos', () => {
    const partial: VehicleLegalInput = {
      ...minVehicle,
      plate: '1234-ABC',
      vin: 'WDB123',
      desiredPrice: 25000,
      photoCount: 5,
    }
    const pct = calculateCompletionPercent(partial, noDocs)
    expect(pct).toBeGreaterThan(0)
    expect(pct).toBeLessThan(100)
  })
})
