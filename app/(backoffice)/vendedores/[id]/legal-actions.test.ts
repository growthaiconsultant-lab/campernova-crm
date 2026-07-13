import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth', () => ({
  requireAgente: vi.fn(),
  requireAdmin: vi.fn(),
}))

// PR5B2: los documentos privados se operan con el cliente service_role (server-only).
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/storage', () => ({
  VEHICLE_DOCUMENTS_BUCKET: 'vehicle-documents',
  vehicleDocumentSignedUrl: vi.fn(),
  deleteVehicleDocumentFiles: vi.fn(),
  // Extrae el path de una URL firmada legacy o devuelve el path (null si no resoluble).
  extractVehicleDocumentPath: vi.fn((stored: string) => {
    if (!stored) return null
    const safe = (p: string) => (p && !p.startsWith('/') && !p.includes('..') ? p : null)
    if (!stored.startsWith('http')) return safe(stored)
    const oi = stored.indexOf('/storage/v1/object/')
    const bi = stored.indexOf('/vehicle-documents/')
    if (oi === -1 || bi === -1 || bi < oi) return null
    let p = stored.slice(bi + '/vehicle-documents/'.length)
    const q = p.indexOf('?')
    if (q !== -1) p = p.slice(0, q)
    return safe(p)
  }),
}))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    vehicle: { findUnique: vi.fn(), update: vi.fn() },
    vehicleDocument: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    documentVersion: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireAdmin, requireAgente } from '@/lib/auth'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { vehicleDocumentSignedUrl, deleteVehicleDocumentFiles } from '@/lib/supabase/storage'
import {
  uploadVehicleDocument,
  deleteVehicleDocument,
  updateVehicleLegalFields,
  markChargesChecked,
  getVehicleDocumentSignedUrl,
} from './legal-actions'

const mockAdmin = { id: 'admin-1', role: 'ADMIN' as const, name: 'Admin' } as unknown as User
const mockAgent = { id: 'agent-1', role: 'AGENTE' as const, name: 'Agente' } as unknown as User

const mockSupabase = {
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as never)
  // Por defecto: sin versiones (fila legacy) → el borrado cae al `url` legacy.
  mockDb.documentVersion.findMany.mockResolvedValue([])
  mockDb.documentVersion.create.mockResolvedValue({ id: 'ver-1' })
  mockDb.$transaction.mockImplementation(async (ops: unknown) => {
    if (typeof ops === 'function') return (ops as (tx: typeof mockDb) => Promise<unknown>)(mockDb)
    const results = await Promise.all(ops as Promise<unknown>[])
    return results
  })
})

// ─── uploadVehicleDocument ────────────────────────────────────────────────────

describe('uploadVehicleDocument', () => {
  it('permite a AGENTE subir un documento y guarda el PATH (no una URL firmada)', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1' })
    mockDb.vehicleDocument.create.mockResolvedValue({ id: 'doc-1' })
    mockDb.activity.create.mockResolvedValue({})

    const fd = new FormData()
    const file = new File([new Uint8Array(100)], 'contrato.pdf', { type: 'application/pdf' })
    fd.set('file', file)
    fd.set('category', 'CONTRATO_COMPRAVENTA')
    fd.set('name', 'Contrato de compraventa')

    const result = await uploadVehicleDocument('v-1', fd)
    expect(result.ok).toBe(true)

    // Se persiste el object PATH interno docs/<vehicleId>/<uuid>.pdf, nunca una URL http, y
    // el segmento medio es un UUID de servidor (no el nombre de fichero del usuario).
    const stored = mockDb.vehicleDocument.create.mock.calls[0][0].data.url as string
    expect(stored).toMatch(/^docs\/v-1\/[0-9a-f-]{36}\.pdf$/)
    expect(stored.startsWith('http')).toBe(false)
    expect(stored).not.toContain('contrato')
  })

  it('rechaza si no hay archivo', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)

    const fd = new FormData()
    fd.set('category', 'DNI_VENDEDOR')

    const result = await uploadVehicleDocument('v-1', fd)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/archivo/i)
    expect(mockDb.vehicleDocument.create).not.toHaveBeenCalled()
  })

  it('rechaza un tipo de archivo no permitido (validación server-side)', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)

    const fd = new FormData()
    const file = new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })
    fd.set('file', file)
    fd.set('category', 'DNI_VENDEDOR')

    const result = await uploadVehicleDocument('v-1', fd)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/no permitido/i)
    expect(mockDb.vehicleDocument.create).not.toHaveBeenCalled()
  })

  it('rechaza una discordancia MIME↔extensión (doble extensión engañosa)', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)

    const fd = new FormData()
    const file = new File(['x'], 'contrato.pdf.html', { type: 'application/pdf' })
    fd.set('file', file)
    fd.set('category', 'DNI_VENDEDOR')

    const result = await uploadVehicleDocument('v-1', fd)
    expect(result.ok).toBe(false)
    expect(mockDb.vehicleDocument.create).not.toHaveBeenCalled()
  })

  it('rechaza archivo > 10 MB', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)

    const bigBuffer = new Uint8Array(11 * 1024 * 1024)
    const file = new File([bigBuffer], 'big.pdf', { type: 'application/pdf' })
    const fd = new FormData()
    fd.set('file', file)
    fd.set('category', 'DNI_VENDEDOR')

    const result = await uploadVehicleDocument('v-1', fd)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/10 MB/i)
  })

  it('devuelve error si el vehículo no existe', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)
    mockDb.vehicle.findUnique.mockResolvedValue(null)

    const fd = new FormData()
    const file = new File([new Uint8Array(100)], 'doc.pdf', { type: 'application/pdf' })
    fd.set('file', file)
    fd.set('category', 'DNI_VENDEDOR')

    const result = await uploadVehicleDocument('v-unknown', fd)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/vehículo/i)
  })
})

// ─── deleteVehicleDocument ────────────────────────────────────────────────────

describe('deleteVehicleDocument', () => {
  const docRow = {
    id: 'doc-1',
    vehicleId: 'v-1',
    name: 'Contrato',
    category: 'CONTRATO_COMPRAVENTA',
    url: 'docs/v-1/doc.pdf',
    vehicle: { sellerLeadId: 'sl-1' },
  }

  it('elimina el objeto y luego el registro (Storage confirma primero)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicleDocument.findUnique.mockResolvedValue({ ...docRow })
    vi.mocked(deleteVehicleDocumentFiles).mockResolvedValue(true)
    mockDb.vehicleDocument.delete.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    const result = await deleteVehicleDocument('doc-1')
    expect(result.ok).toBe(true)
    // Fila legacy (sin versiones): se borra el objeto del `url` resuelto, ANTES del registro.
    expect(deleteVehicleDocumentFiles).toHaveBeenCalledWith(expect.anything(), ['docs/v-1/doc.pdf'])
    expect(mockDb.vehicleDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } })
  })

  it('borra los objetos de TODAS las versiones cuando el documento está versionado', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicleDocument.findUnique.mockResolvedValue({ ...docRow })
    // Documento con historial: 2 versiones → se borran ambos objetos, sin huérfanos.
    mockDb.documentVersion.findMany.mockResolvedValue([
      { bucket: 'vehicle-documents', objectPath: 'docs/v-1/v2.pdf' },
      { bucket: 'vehicle-documents', objectPath: 'docs/v-1/v1.pdf' },
    ])
    vi.mocked(deleteVehicleDocumentFiles).mockResolvedValue(true)
    mockDb.vehicleDocument.delete.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    const result = await deleteVehicleDocument('doc-1')
    expect(result.ok).toBe(true)
    expect(deleteVehicleDocumentFiles).toHaveBeenCalledWith(expect.anything(), [
      'docs/v-1/v2.pdf',
      'docs/v-1/v1.pdf',
    ])
    expect(mockDb.vehicleDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } })
  })

  it('NO elimina el registro si el borrado en Storage falla (sin éxito con estado incierto)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicleDocument.findUnique.mockResolvedValue({ ...docRow })
    vi.mocked(deleteVehicleDocumentFiles).mockResolvedValue(false) // Storage falla

    const result = await deleteVehicleDocument('doc-1')
    expect(result.ok).toBe(false)
    expect(mockDb.vehicleDocument.delete).not.toHaveBeenCalled()
  })

  it('rechaza si el path no se puede resolver (URL externa/otro bucket) sin borrar nada', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicleDocument.findUnique.mockResolvedValue({
      ...docRow,
      url: 'https://evil.com/vehicle-documents/x.pdf',
    })

    const result = await deleteVehicleDocument('doc-1')
    expect(result.ok).toBe(false)
    expect(deleteVehicleDocumentFiles).not.toHaveBeenCalled()
    expect(mockDb.vehicleDocument.delete).not.toHaveBeenCalled()
  })

  it('devuelve error si el documento no existe', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicleDocument.findUnique.mockResolvedValue(null)

    const result = await deleteVehicleDocument('doc-x')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/documento/i)
  })
})

// ─── updateVehicleLegalFields ─────────────────────────────────────────────────

describe('updateVehicleLegalFields', () => {
  it('solo ADMIN puede actualizar campos legales', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicle.findUnique.mockResolvedValue({
      sellerLeadId: 'sl-1',
      plate: null,
      vin: null,
      itvValidUntil: null,
      titleTransferredAt: null,
    })
    mockDb.vehicle.update.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    const result = await updateVehicleLegalFields('v-1', {
      plate: '1234-ABC',
      vin: 'WDB1234',
    })
    expect(result.ok).toBe(true)
  })

  it('crea actividad MATRICULA_AÑADIDA al cambiar la matrícula', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicle.findUnique.mockResolvedValue({
      sellerLeadId: 'sl-1',
      plate: null,
      vin: null,
      itvValidUntil: null,
      titleTransferredAt: null,
    })
    mockDb.vehicle.update.mockResolvedValue({})

    const activitiesCreated: unknown[] = []
    mockDb.$transaction.mockImplementation(async (ops: unknown[]) => {
      const results = await Promise.all(ops as Promise<unknown>[])
      return results
    })
    mockDb.activity.create.mockImplementation((args: { data: { type: string } }) => {
      activitiesCreated.push(args.data)
      return Promise.resolve({})
    })

    await updateVehicleLegalFields('v-1', { plate: '5678-XYZ' })

    const types = activitiesCreated.map((a) => (a as { type: string }).type)
    expect(types).toContain('MATRICULA_AÑADIDA')
  })

  it('devuelve error si el vehículo no existe', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicle.findUnique.mockResolvedValue(null)

    const result = await updateVehicleLegalFields('v-x', { plate: '1234-ABC' })
    expect(result.ok).toBe(false)
  })
})

// ─── markChargesChecked ───────────────────────────────────────────────────────

describe('markChargesChecked', () => {
  it('solo ADMIN puede verificar cargas', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1' })
    mockDb.vehicle.update.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    const result = await markChargesChecked('v-1')
    expect(result.ok).toBe(true)
  })

  it('incluye notas opcionales en el log de actividad', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1' })
    mockDb.vehicle.update.mockResolvedValue({})

    let activityContent = ''
    mockDb.activity.create.mockImplementation((args: { data: { content: string } }) => {
      activityContent = args.data.content
      return Promise.resolve({})
    })

    await markChargesChecked('v-1', 'Sin cargas pendientes')
    expect(activityContent).toContain('Sin cargas pendientes')
  })

  it('devuelve error si el vehículo no existe', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicle.findUnique.mockResolvedValue(null)

    const result = await markChargesChecked('v-x')
    expect(result.ok).toBe(false)
  })
})

// ─── getVehicleDocumentSignedUrl ──────────────────────────────────────────────

describe('getVehicleDocumentSignedUrl', () => {
  it('SIEMPRE genera una URL firmada nueva y corta desde el path (no re-sirve la almacenada)', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)
    mockDb.vehicleDocument.findUnique.mockResolvedValue({ url: 'docs/v-1/doc.pdf' })
    vi.mocked(vehicleDocumentSignedUrl).mockResolvedValue('https://freshly.signed/url')

    const result = await getVehicleDocumentSignedUrl('doc-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.url).toBe('https://freshly.signed/url')
    // Firma (supabase, path, ttl) → se firma en corto (TTL ≤ 300s), no re-usando ningún http.
    const ttl = vi.mocked(vehicleDocumentSignedUrl).mock.calls[0][2]
    expect(ttl).toBeLessThanOrEqual(300)
  })

  it('para una fila legacy con URL firmada de larga duración, extrae el path y re-firma en corto', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)
    mockDb.vehicleDocument.findUnique.mockResolvedValue({
      url: 'https://x.supabase.co/storage/v1/object/sign/vehicle-documents/docs/v-1/doc.pdf?token=OLD_1YEAR',
    })
    vi.mocked(vehicleDocumentSignedUrl).mockResolvedValue('https://freshly.signed/short')

    const result = await getVehicleDocumentSignedUrl('doc-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.url).toBe('https://freshly.signed/short')
    // No devuelve la URL de 1 año almacenada; firma desde el path extraído (arg 1).
    const path = vi.mocked(vehicleDocumentSignedUrl).mock.calls[0][1]
    expect(path).toBe('docs/v-1/doc.pdf')
  })

  it('prioriza el objectPath de la versión ACTUAL sobre el `url` legacy (PR5B1)', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)
    // Fila versionada: `url` legacy antiguo + currentVersion con el path vigente. Debe firmarse
    // el path de la versión actual, no el legacy.
    mockDb.vehicleDocument.findUnique.mockResolvedValue({
      url: 'docs/v-1/OLD.pdf',
      currentVersion: { objectPath: 'docs/v-1/CURRENT.pdf' },
    })
    vi.mocked(vehicleDocumentSignedUrl).mockResolvedValue('https://freshly.signed/current')

    const result = await getVehicleDocumentSignedUrl('doc-1')
    expect(result.ok).toBe(true)
    const path = vi.mocked(vehicleDocumentSignedUrl).mock.calls[0][1]
    expect(path).toBe('docs/v-1/CURRENT.pdf')
  })

  it('devuelve error si el documento no existe', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)
    mockDb.vehicleDocument.findUnique.mockResolvedValue(null)

    const result = await getVehicleDocumentSignedUrl('doc-x')
    expect(result.ok).toBe(false)
  })
})
