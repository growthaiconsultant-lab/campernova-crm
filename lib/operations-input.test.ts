import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import {
  manualDeliverySchema,
  operationalTargetSchema,
  documentTargetWhere,
} from './operations-input'
import { canManageOperationalDeliveries, canUseOperationalDocuments } from './operations-policy'
import { validateOperationalFile } from './operational-documents'
import type { UserRole } from '@prisma/client'

describe('OPS-1 permisos y validación', () => {
  it.each([
    ['ADMIN', true, true],
    ['AGENTE', false, true],
    ['TALLER', true, true],
    ['ENTREGAS', true, false],
    ['MARKETING', false, false],
  ] as const)('%s: entregas=%s documentos=%s', (role, deliveries, documents) => {
    expect(canManageOperationalDeliveries({ role: role as UserRole, active: true })).toBe(
      deliveries
    )
    expect(canUseOperationalDocuments({ role: role as UserRole, active: true })).toBe(documents)
    expect(canManageOperationalDeliveries({ role: role as UserRole, active: false })).toBe(false)
    expect(canUseOperationalDocuments({ role: role as UserRole, active: false })).toBe(false)
  })
  it.each(['VENTA', 'DEVOLUCION_VENDEDOR', 'ENTREGA_TALLER'] as const)(
    'valida %s sin oferta ni match',
    (kind) => {
      expect(
        manualDeliverySchema.safeParse({
          operationId: randomUUID(),
          vehicleId: 'qa',
          kind,
          recipient: { type: kind === 'VENTA' ? 'buyerLead' : 'sellerLead', id: 'qa' },
          scheduledAt: '2026-10-01T10:00:00Z',
        }).success
      ).toBe(true)
    }
  )
  it.each([
    ['VENTA', 'sellerLead'],
    ['DEVOLUCION_VENDEDOR', 'buyerLead'],
    ['ENTREGA_TALLER', 'vehicle'],
  ] as const)('rechaza %s con destinatario %s', (kind, type) => {
    expect(
      manualDeliverySchema.safeParse({
        operationId: randomUUID(),
        vehicleId: 'qa',
        kind,
        recipient: { type, id: 'qa' },
        scheduledAt: '2026-10-01T10:00:00Z',
      }).success
    ).toBe(false)
  })
  it('destino exacto; no paths ni nombres de tabla arbitrarios', () => {
    expect(documentTargetWhere({ type: 'buyerLead', id: 'qa' })).toEqual({
      vehicleId: null,
      buyerLeadId: 'qa',
      sellerLeadId: null,
    })
    expect(operationalTargetSchema.safeParse({ type: 'users', id: 'qa' }).success).toBe(false)
    expect(operationalTargetSchema.safeParse({ type: 'vehicle', id: '../qa' }).success).toBe(false)
  })
  it.each([
    ['application/pdf', 'qa.pdf', [37, 80, 68, 70, 45]],
    ['image/jpeg', 'qa.jpg', [255, 216, 255]],
    ['image/png', 'qa.png', [137, 80, 78, 71, 13, 10, 26, 10]],
    ['image/webp', 'qa.webp', [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]],
  ] as const)('acepta %s con cabecera coherente', (mimeType, fileName, content) => {
    expect(
      validateOperationalFile({ mimeType, fileName, size: content.length }, new Uint8Array(content))
    ).toHaveProperty('ext')
  })
  it('rechaza vacío, exceso, traversal, formato activo y MIME falso', () => {
    for (const file of [
      { mimeType: 'application/pdf', fileName: 'qa.pdf', size: 0 },
      { mimeType: 'application/pdf', fileName: 'qa.pdf', size: 10 * 1024 * 1024 + 1 },
      { mimeType: 'application/pdf', fileName: '../qa.pdf', size: 5 },
      { mimeType: 'text/html', fileName: 'qa.html', size: 5 },
      { mimeType: 'application/pdf', fileName: 'qa.pdf', size: 5 },
      { mimeType: 'application/msword', fileName: 'qa.doc', size: 5 },
    ])
      expect(() =>
        validateOperationalFile(file, new Uint8Array([60, 104, 116, 109, 108]))
      ).toThrow()
  })
})
