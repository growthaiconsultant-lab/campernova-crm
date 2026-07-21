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
    vehicle: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
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
import { revalidatePath } from 'next/cache'
import { VEHICLE_TRANSITIONS } from '@/lib/state-machine'
import { updateVehicle, discardSellerLead } from './actions'
import {
  VEHICLE_STATUS_CONFLICT_MESSAGE,
  INVALID_VEHICLE_TRANSITION_MESSAGE,
} from '@/lib/vehicle-status'

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
    mockDb.vehicle.updateMany.mockResolvedValue({ count: 1 })
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
    mockDb.vehicle.updateMany.mockResolvedValue({ count: 1 })
    mockDb.activity.create.mockResolvedValue({})

    // PUBLICADO → DESCARTADO: transición manual válida que no pasa por el expediente legal.
    // (Antes usaba PUBLICADO → RESERVADO, que I3A rechaza: el test habría pasado en vacío.)
    const result = await updateVehicle('v-1', { ...baseVehicleData, status: 'DESCARTADO' })

    expect(result).toMatchObject({ ok: true })
    expect(getVehicleLegalInput).not.toHaveBeenCalled()
    expect(isReadyForStatus).not.toHaveBeenCalled()
  })

  it('el guard se salta si el vehículo ya está en TASADO y se mantiene en TASADO', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'TASADO' })
    mockDb.vehicle.updateMany.mockResolvedValue({ count: 1 })
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

// ─── Fact de venta canónico — soldAt en la transición a VENDIDO (Fase 1A-1) ────

// ─── I3A: transiciones manuales retiradas ─────────────────────────────────────

describe('updateVehicle — transiciones manuales retiradas (I3A)', () => {
  const rechazadas: Array<[string, string]> = [
    ['PUBLICADO', 'RESERVADO'], // reservar a mano invade el dominio de ofertas
    ['RESERVADO', 'PUBLICADO'], // liberar a mano invade el dominio de ofertas
    ['RESERVADO', 'VENDIDO'], // vender a mano invade el dominio de entregas
    ['PUBLICADO', 'VENDIDO'],
    ['TASADO', 'VENDIDO'],
    ['NUEVO', 'VENDIDO'],
    ['RESERVADO', 'DESCARTADO'], // no hay salidas manuales desde RESERVADO
  ]

  it.each(rechazadas)('%s → %s se rechaza sin escribir nada', async (from, to) => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: from })

    const result = await updateVehicle('v-1', { ...baseVehicleData, status: to })

    expect(result).toMatchObject({
      error: { formErrors: [INVALID_VEHICLE_TRANSITION_MESSAGE] },
    })
    expect(mockDb.vehicle.updateMany).not.toHaveBeenCalled()
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('el mensaje de transición inválida no filtra estado interno, ids ni SQL', () => {
    expect(INVALID_VEHICLE_TRANSITION_MESSAGE).toBe('Este cambio de estado no está permitido.')
    expect(INVALID_VEHICLE_TRANSITION_MESSAGE).not.toMatch(
      /prisma|select|update |v-1|[0-9a-f]{20,}/i
    )
  })

  it('la tabla canónica no ofrece ninguna transición manual a RESERVADO ni a VENDIDO', () => {
    const destinos = Object.values(VEHICLE_TRANSITIONS).flat()
    expect(destinos).not.toContain('RESERVADO')
    expect(destinos).not.toContain('VENDIDO')
    // La UI deriva sus opciones de esta misma tabla, así que deja de ofrecerlas automáticamente.
    expect(VEHICLE_TRANSITIONS.RESERVADO).toBeUndefined()
  })

  it('conserva las transiciones manuales legítimas', () => {
    expect(VEHICLE_TRANSITIONS.NUEVO).toContain('TASADO')
    expect(VEHICLE_TRANSITIONS.TASADO).toContain('PUBLICADO')
    // El descarte conserva su comportamiento actual; los blockers llegan en I3B.
    expect(VEHICLE_TRANSITIONS.NUEVO).toContain('DESCARTADO')
    expect(VEHICLE_TRANSITIONS.TASADO).toContain('DESCARTADO')
    expect(VEHICLE_TRANSITIONS.PUBLICADO).toContain('DESCARTADO')
  })

  it('editar un vehículo VENDIDO sin cambiar de estado sigue permitido', async () => {
    // `from === to` es válido: un vehículo terminal conserva sus campos editables.
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'VENDIDO' })
    mockDb.vehicle.updateMany.mockResolvedValue({ count: 1 })

    const result = await updateVehicle('v-1', { ...baseVehicleData, status: 'VENDIDO' })

    expect(result).toMatchObject({ ok: true })
    expect(mockDb.activity.create).not.toHaveBeenCalled() // no hay cambio de estado
  })

  it('editar un vehículo RESERVADO sin cambiar de estado sigue permitido', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'RESERVADO' })
    mockDb.vehicle.updateMany.mockResolvedValue({ count: 1 })

    const result = await updateVehicle('v-1', { ...baseVehicleData, status: 'RESERVADO' })

    expect(result).toMatchObject({ ok: true })
  })

  it('updateVehicle ya no consulta entregas: la venta dejó de ser asunto suyo', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'RESERVADO' })

    await updateVehicle('v-1', { ...baseVehicleData, status: 'VENDIDO' })

    expect(mockDb.delivery.findFirst).not.toHaveBeenCalled()
  })
})

// ─── I3A: CAS sobre el estado releído ─────────────────────────────────────────

describe('updateVehicle — CAS de estado (I3A)', () => {
  it('la escritura va condicionada al estado releído', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'NUEVO' })
    mockDb.vehicle.updateMany.mockResolvedValue({ count: 1 })

    await updateVehicle('v-1', { ...baseVehicleData, status: 'NUEVO' })

    const arg = mockDb.vehicle.updateMany.mock.calls[0][0]
    expect(arg.where).toEqual({ id: 'v-1', status: 'NUEVO' })
  })

  it('CAS con cero filas → conflicto seguro, sin Activity ni efectos posteriores', async () => {
    // Otro proceso movió el vehículo entre la relectura y la escritura.
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'PUBLICADO' })
    mockDb.vehicle.updateMany.mockResolvedValue({ count: 0 })

    const result = await updateVehicle('v-1', { ...baseVehicleData, status: 'DESCARTADO' })

    expect(result).toMatchObject({ error: { formErrors: [VEHICLE_STATUS_CONFLICT_MESSAGE] } })
    expect(mockDb.activity.create).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('el mensaje de conflicto es seguro y accionable', () => {
    expect(VEHICLE_STATUS_CONFLICT_MESSAGE).toContain('Recarga')
    expect(VEHICLE_STATUS_CONFLICT_MESSAGE).not.toMatch(/prisma|select|update |v-1|[0-9a-f]{20,}/i)
  })

  it('la Activity solo se escribe tras un CAS exitoso y con cambio de estado', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'NUEVO' })
    mockDb.vehicle.updateMany.mockResolvedValue({ count: 1 })

    await updateVehicle('v-1', { ...baseVehicleData, status: 'DESCARTADO' })

    expect(mockDb.activity.create).toHaveBeenCalledTimes(1)
    expect(mockDb.activity.create.mock.calls[0][0].data.type).toBe('CAMBIO_ESTADO')
  })

  it('un error técnico inesperado se propaga, no se disfraza de conflicto', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1', status: 'NUEVO' })
    mockDb.vehicle.updateMany.mockRejectedValue(new Error('boom'))

    await expect(updateVehicle('v-1', { ...baseVehicleData, status: 'NUEVO' })).rejects.toThrow(
      'boom'
    )
  })
})

// ─── discardSellerLead — decisión comercial (NO archiva, NO elimina) ───────────

describe('discardSellerLead', () => {
  it('descarta (→ DESCARTADO) con motivo y guarda lostReason + notas', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'NUEVO' })
    const res = await discardSellerLead('s1', 'PRECIO', 'pide muy por encima de la tasación')
    expect(res).toEqual({ error: null })
    expect(mockDb.sellerLead.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: {
        status: 'DESCARTADO',
        lostReason: 'PRECIO',
        lostReasonNotes: 'pide muy por encima de la tasación',
      },
    })
  })

  it('registra una Activity con el motivo', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'CONTACTADO' })
    await discardSellerLead('s1', 'PRECIO')
    const activity = mockDb.activity.create.mock.calls[0][0].data
    expect(activity.type).toBe('CAMBIO_ESTADO')
    expect(activity.sellerLeadId).toBe('s1')
    expect(activity.agentId).toBe('agent-1')
    expect(activity.content).toContain('Motivo: Precio')
  })

  it('rechaza descartar sin motivo (CAM-61)', async () => {
    const res = await discardSellerLead('s1')
    expect(res.error).toContain('motivo')
    expect(mockDb.sellerLead.update).not.toHaveBeenCalled()
  })

  it('rechaza un motivo inválido', async () => {
    const res = await discardSellerLead('s1', 'INVENTADO')
    expect(res.error).toContain('motivo')
    expect(mockDb.sellerLead.update).not.toHaveBeenCalled()
  })

  it('notas vacías se guardan como null', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'NUEVO' })
    await discardSellerLead('s1', 'NO_RESPONDE', '   ')
    expect(mockDb.sellerLead.update.mock.calls[0][0].data.lostReasonNotes).toBeNull()
  })

  it('no descarta un lead ya en estado terminal', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'CERRADO' })
    const res = await discardSellerLead('s1', 'PRECIO')
    expect(res.error).toContain('estado final')
    expect(mockDb.sellerLead.update).not.toHaveBeenCalled()
  })

  it('NO archiva ni elimina: solo cambia estado; no toca vehículo ni añade campos de archivado', async () => {
    mockDb.sellerLead.findUnique.mockResolvedValue({ status: 'NUEVO' })
    await discardSellerLead('s1', 'PRECIO')
    const data = mockDb.sellerLead.update.mock.calls[0][0].data
    // Solo los tres campos de la decisión comercial: ningún campo de archivado ni de borrado.
    expect(Object.keys(data).sort()).toEqual(['lostReason', 'lostReasonNotes', 'status'])
    expect(data).not.toHaveProperty('archivedAt')
    expect(data).not.toHaveProperty('deletedAt')
    // No se modifica el vehículo asociado ni ninguna otra entidad de negocio.
    expect(mockDb.vehicle.update).not.toHaveBeenCalled()
  })
})
