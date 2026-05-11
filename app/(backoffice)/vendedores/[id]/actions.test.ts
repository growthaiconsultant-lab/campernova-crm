import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth', () => ({
  requireAgente: vi.fn(),
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/valuation/save', () => ({
  runAndSaveAutoValuation: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/matching', () => ({
  recalculateMatchesForVehicle: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/vehicle-legal', () => ({
  getVehicleLegalInput: vi.fn(),
  getVehicleDocumentSummary: vi.fn(),
  listMissingRequirements: vi.fn(),
  isReadyForStatus: vi.fn(),
}))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    sellerLead: { findUnique: vi.fn(), update: vi.fn() },
    vehicle: { findUnique: vi.fn(), update: vi.fn() },
    delivery: { findFirst: vi.fn() },
    activity: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireAgente } from '@/lib/auth'
import {
  getVehicleLegalInput,
  getVehicleDocumentSummary,
  isReadyForStatus,
  listMissingRequirements,
} from '@/lib/vehicle-legal'
import { updateVehicle } from './actions'

const mockAgent = { id: 'agent-1', role: 'AGENTE' as const, name: 'Agente' } as unknown as User

const baseVehicleData = {
  type: 'CAMPER' as const,
  brand: 'Volkswagen',
  model: 'California',
  year: 2020,
  km: 50000,
  seats: 4,
  length: null,
  conservationState: 'BUENO' as const,
  location: 'Barcelona',
  desiredPrice: 45000,
  equipment: {
    solar: false,
    kitchen: true,
    bathroom: false,
    shower: false,
    heating: true,
  },
}

const mockLegalInput = {
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

const mockDocs = [
  { category: 'DNI_VENDEDOR' as const, exists: false },
  { category: 'CONTRATO_COMPRAVENTA' as const, exists: false },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue(mockAgent)
  mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) => {
    if (typeof fn === 'function') return fn(mockDb)
    return Promise.all(fn as unknown as Promise<unknown>[])
  })
})

// ─── Legal guard — NUEVO → TASADO ─────────────────────────────────────────────

describe('updateVehicle — guard TASADO', () => {
  it('bloquea la transición NUEVO→TASADO si faltan requisitos', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'NUEVO' })
    vi.mocked(getVehicleLegalInput).mockResolvedValue(mockLegalInput)
    vi.mocked(getVehicleDocumentSummary).mockResolvedValue(mockDocs)
    vi.mocked(isReadyForStatus).mockReturnValue(false)
    vi.mocked(listMissingRequirements).mockReturnValue([
      { field: 'plate', message: 'Matrícula obligatoria', severity: 'error' },
      { field: 'desiredPrice', message: 'Precio deseado obligatorio', severity: 'error' },
    ])
    mockDb.activity.create.mockResolvedValue({})

    const result = await updateVehicle('v-1', {
      ...baseVehicleData,
      status: 'TASADO',
      desiredPrice: null,
    })

    expect(result.error).toBeDefined()
    expect(result.error?.formErrors[0]).toMatch(/Matrícula obligatoria|Precio deseado/)
  })

  it('registra actividad PUBLICACION_BLOQUEADA al bloquear', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'NUEVO' })
    vi.mocked(getVehicleLegalInput).mockResolvedValue(mockLegalInput)
    vi.mocked(getVehicleDocumentSummary).mockResolvedValue(mockDocs)
    vi.mocked(isReadyForStatus).mockReturnValue(false)
    vi.mocked(listMissingRequirements).mockReturnValue([
      { field: 'plate', message: 'Matrícula obligatoria', severity: 'error' },
    ])

    let activityType = ''
    mockDb.activity.create.mockImplementation((args: { data: { type: string } }) => {
      activityType = args.data.type
      return Promise.resolve({})
    })

    await updateVehicle('v-1', { ...baseVehicleData, status: 'TASADO', desiredPrice: null })

    expect(activityType).toBe('PUBLICACION_BLOQUEADA')
  })

  it('permite la transición NUEVO→TASADO cuando los requisitos están completos', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'NUEVO' })
    vi.mocked(getVehicleLegalInput).mockResolvedValue({
      ...mockLegalInput,
      plate: '1234-ABC',
      desiredPrice: 45000,
      photoCount: 1,
    })
    vi.mocked(getVehicleDocumentSummary).mockResolvedValue(mockDocs)
    vi.mocked(isReadyForStatus).mockReturnValue(true)
    mockDb.vehicle.update.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    const result = await updateVehicle('v-1', { ...baseVehicleData, status: 'TASADO' })

    expect(result.error).toBeUndefined()
    expect(result).toMatchObject({ ok: true })
  })
})

// ─── Legal guard — TASADO → PUBLICADO ────────────────────────────────────────

describe('updateVehicle — guard PUBLICADO', () => {
  it('bloquea la transición TASADO→PUBLICADO si faltan documentos', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'TASADO' })
    vi.mocked(getVehicleLegalInput).mockResolvedValue({
      ...mockLegalInput,
      plate: '1234-ABC',
      desiredPrice: 45000,
      photoCount: 5,
    })
    vi.mocked(getVehicleDocumentSummary).mockResolvedValue(mockDocs)
    vi.mocked(isReadyForStatus).mockReturnValue(false)
    vi.mocked(listMissingRequirements).mockReturnValue([
      { field: 'doc_DNI_VENDEDOR', message: 'DNI del vendedor obligatorio', severity: 'error' },
      {
        field: 'doc_CONTRATO_COMPRAVENTA',
        message: 'Contrato de compraventa obligatorio',
        severity: 'error',
      },
    ])
    mockDb.activity.create.mockResolvedValue({})

    const result = await updateVehicle('v-1', { ...baseVehicleData, status: 'PUBLICADO' })

    expect(result.error).toBeDefined()
    expect(result.error?.formErrors[0]).toMatch(/DNI del vendedor|Contrato/)
  })

  it('no vuelve a comprobar el expediente si la transición no involucra TASADO/PUBLICADO', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'PUBLICADO' })
    mockDb.vehicle.update.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    await updateVehicle('v-1', { ...baseVehicleData, status: 'RESERVADO' })

    expect(getVehicleLegalInput).not.toHaveBeenCalled()
    expect(isReadyForStatus).not.toHaveBeenCalled()
  })

  it('el guard se salta si el vehículo ya está en TASADO y se mantiene en TASADO', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'TASADO' })
    mockDb.vehicle.update.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    await updateVehicle('v-1', { ...baseVehicleData, status: 'TASADO' })

    expect(isReadyForStatus).not.toHaveBeenCalled()
  })

  it('bloquea si hay órdenes de taller activas', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'TASADO' })
    vi.mocked(getVehicleLegalInput).mockResolvedValue({
      ...mockLegalInput,
      workOrdersBlockingCount: 2,
      plate: '1234-ABC',
      desiredPrice: 45000,
      photoCount: 5,
    })
    vi.mocked(getVehicleDocumentSummary).mockResolvedValue(mockDocs)
    vi.mocked(isReadyForStatus).mockReturnValue(false)
    vi.mocked(listMissingRequirements).mockReturnValue([
      { field: 'workOrders', message: 'Hay 2 ordenes de taller sin completar', severity: 'error' },
    ])
    mockDb.activity.create.mockResolvedValue({})

    const result = await updateVehicle('v-1', { ...baseVehicleData, status: 'PUBLICADO' })

    expect(result.error?.formErrors[0]).toMatch(/2 orden/)
  })
})
