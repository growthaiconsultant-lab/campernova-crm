import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth', () => ({
  requireAgente: vi.fn(),
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/storage', () => ({
  vehicleDocumentPath: vi.fn(
    (vehicleId: string, fileName: string) => `docs/${vehicleId}/${fileName}`
  ),
  vehicleDocumentSignedUrl: vi.fn(),
  deleteVehicleDocumentFile: vi.fn(),
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
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireAdmin, requireAgente } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { vehicleDocumentSignedUrl, deleteVehicleDocumentFile } from '@/lib/supabase/storage'
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
  vi.mocked(createServerClient).mockReturnValue(mockSupabase as never)
  mockDb.$transaction.mockImplementation(async (ops: unknown) => {
    if (typeof ops === 'function') return (ops as (tx: typeof mockDb) => Promise<unknown>)(mockDb)
    const results = await Promise.all(ops as Promise<unknown>[])
    return results
  })
})

// ─── uploadVehicleDocument ────────────────────────────────────────────────────

describe('uploadVehicleDocument', () => {
  it('permite a AGENTE subir un documento', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1' })
    vi.mocked(vehicleDocumentSignedUrl).mockResolvedValue('https://signed.url/doc.pdf')
    mockDb.vehicleDocument.create.mockResolvedValue({ id: 'doc-1' })
    mockDb.activity.create.mockResolvedValue({})

    const fd = new FormData()
    const file = new File([new Uint8Array(100)], 'contrato.pdf', { type: 'application/pdf' })
    fd.set('file', file)
    fd.set('category', 'CONTRATO_COMPRAVENTA')
    fd.set('name', 'Contrato de compraventa')

    const result = await uploadVehicleDocument('v-1', fd)
    expect(result.ok).toBe(true)
  })

  it('rechaza si no hay archivo', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)

    const fd = new FormData()
    fd.set('category', 'DNI_VENDEDOR')

    const result = await uploadVehicleDocument('v-1', fd)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/archivo/i)
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
  it('permite solo a ADMIN eliminar un documento', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicleDocument.findUnique.mockResolvedValue({
      id: 'doc-1',
      vehicleId: 'v-1',
      name: 'Contrato',
      category: 'CONTRATO_COMPRAVENTA',
      url: 'https://example.com/doc.pdf',
      vehicle: { sellerLeadId: 'sl-1' },
    })
    vi.mocked(deleteVehicleDocumentFile).mockResolvedValue(true)
    mockDb.vehicleDocument.delete.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    const result = await deleteVehicleDocument('doc-1')
    expect(result.ok).toBe(true)
    expect(mockDb.vehicleDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } })
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
  it('devuelve la URL tal cual si ya es una URL completa', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)
    mockDb.vehicleDocument.findUnique.mockResolvedValue({
      url: 'https://signed.supabase.co/path/to/doc.pdf',
    })

    const result = await getVehicleDocumentSignedUrl('doc-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.url).toBe('https://signed.supabase.co/path/to/doc.pdf')
  })

  it('regenera URL firmada si el valor es un path', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)
    mockDb.vehicleDocument.findUnique.mockResolvedValue({ url: 'docs/v-1/doc.pdf' })
    vi.mocked(vehicleDocumentSignedUrl).mockResolvedValue('https://freshly.signed/url')

    const result = await getVehicleDocumentSignedUrl('doc-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.url).toBe('https://freshly.signed/url')
  })

  it('devuelve error si el documento no existe', async () => {
    vi.mocked(requireAgente).mockResolvedValue(mockAgent)
    mockDb.vehicleDocument.findUnique.mockResolvedValue(null)

    const result = await getVehicleDocumentSignedUrl('doc-x')
    expect(result.ok).toBe(false)
  })
})
