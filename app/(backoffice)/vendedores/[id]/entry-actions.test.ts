import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  requireAgente: vi.fn(),
  requireAdmin: vi.fn(),
}))
// `withLockedRoots` se mockea para ejecutar el callback con mockDb; los núcleos tx se mockean aparte
// (su lógica se prueba en lib/entry/*.test y en integración PG). LockError se mantiene REAL.
vi.mock('@/lib/locking', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/locking')>()
  return { ...actual, withLockedRoots: vi.fn() }
})
// El núcleo de entrada se mockea para controlar éxito/conflicto; EntryError y helpers REAL.
vi.mock('@/lib/entry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/entry')>()
  return {
    ...actual,
    validateEntryTx: vi.fn(),
    annulEntryTx: vi.fn(),
    registerPhysicalArrivalTx: vi.fn(),
  }
})

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    vehicle: { findUnique: vi.fn() },
    workOrder: { count: vi.fn() },
    vehicleDocumentRequirementDisposition: { upsert: vi.fn(), deleteMany: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { requireAgente, requireAdmin } from '@/lib/auth'
import { withLockedRoots } from '@/lib/locking'
import {
  validateEntryTx,
  annulEntryTx,
  registerPhysicalArrivalTx,
  EntryError,
  ENTRY_ERROR_MESSAGES,
} from '@/lib/entry'
import {
  validateEntry,
  annulEntry,
  registerPhysicalArrival,
  setDocumentDisposition,
} from './entry-actions'

const agente = { id: 'u-agente', role: 'AGENTE' } as User
const admin = { id: 'u-admin', role: 'ADMIN' } as User

const validForm = {
  vehicleId: 'v1',
  parkingLocation: 'Nave A-3',
  keysCount: 2,
  keysLocation: 'Panel llaves',
  keysNotes: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue(agente)
  vi.mocked(requireAdmin).mockResolvedValue(admin)
  // Por defecto, withLockedRoots ejecuta el callback con mockDb como tx.
  vi.mocked(withLockedRoots).mockImplementation((_roots, op) => op(mockDb as never))
  mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 's1' })
  vi.mocked(validateEntryTx).mockResolvedValue({ vehicleId: 'v1', workOrderId: 'wo1' })
  vi.mocked(annulEntryTx).mockResolvedValue({ vehicleId: 'v1', inspectionOrdersClosed: 0 })
  vi.mocked(registerPhysicalArrivalTx).mockResolvedValue({
    vehicleId: 'v1',
    alreadyRegistered: false,
  })
  mockDb.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockDb))
})

describe('registerPhysicalArrival', () => {
  it('AGENTE registra la llegada → ok + revalida', async () => {
    const res = await registerPhysicalArrival({ vehicleId: 'v1' })
    expect(res.ok).toBe(true)
    expect(requireAgente).toHaveBeenCalled()
    expect(registerPhysicalArrivalTx).toHaveBeenCalledOnce()
  })

  it('vehículo inexistente → VEHICLE_NOT_FOUND, sin abrir la tx', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue(null)
    const res = await registerPhysicalArrival({ vehicleId: 'v1' })
    expect(res).toEqual({ ok: false, error: ENTRY_ERROR_MESSAGES.VEHICLE_NOT_FOUND })
    expect(withLockedRoots).not.toHaveBeenCalled()
  })

  it('re-registrar (ya registrada) → ok idempotente (alreadyRegistered)', async () => {
    vi.mocked(registerPhysicalArrivalTx).mockResolvedValue({
      vehicleId: 'v1',
      alreadyRegistered: true,
    })
    const res = await registerPhysicalArrival({ vehicleId: 'v1' })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data?.alreadyRegistered).toBe(true)
  })

  it('LEAD_ARCHIVED del núcleo se traduce a su mensaje', async () => {
    vi.mocked(registerPhysicalArrivalTx).mockRejectedValue(new EntryError('LEAD_ARCHIVED'))
    const res = await registerPhysicalArrival({ vehicleId: 'v1' })
    expect(res).toEqual({ ok: false, error: ENTRY_ERROR_MESSAGES.LEAD_ARCHIVED })
  })
})

describe('validateEntry', () => {
  it('AGENTE puede validar → ok + revalida', async () => {
    const res = await validateEntry(validForm)
    expect(res.ok).toBe(true)
    expect(requireAgente).toHaveBeenCalled()
    expect(validateEntryTx).toHaveBeenCalledOnce()
  })

  it('fase relajada: permite validar SIN ubicación de aparcamiento (la tx decide)', async () => {
    const res = await validateEntry({ ...validForm, parkingLocation: '' })
    expect(res.ok).toBe(true)
    expect(validateEntryTx).toHaveBeenCalledOnce()
  })

  it('fase relajada: permite validar SIN llaves (keysCount 0, sin ubicación)', async () => {
    const res = await validateEntry({ ...validForm, keysCount: 0, keysLocation: '' })
    expect(res.ok).toBe(true)
    expect(validateEntryTx).toHaveBeenCalledOnce()
  })

  it('validar con TODO vacío (solo vehicleId) → ok (nada obligatorio)', async () => {
    const res = await validateEntry({ vehicleId: 'v1' })
    expect(res.ok).toBe(true)
    expect(validateEntryTx).toHaveBeenCalledOnce()
  })

  it('vehículo inexistente → VEHICLE_NOT_FOUND, sin abrir la tx', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue(null)
    const res = await validateEntry(validForm)
    expect(res).toEqual({ ok: false, error: ENTRY_ERROR_MESSAGES.VEHICLE_NOT_FOUND })
    expect(withLockedRoots).not.toHaveBeenCalled()
  })

  it('EntryError del núcleo se traduce a su mensaje', async () => {
    vi.mocked(validateEntryTx).mockRejectedValue(new EntryError('CONTRATO_GESTION_MISSING'))
    const res = await validateEntry(validForm)
    expect(res).toEqual({ ok: false, error: ENTRY_ERROR_MESSAGES.CONTRATO_GESTION_MISSING })
  })

  it('P2002 del índice parcial confirmado por lectura → INSPECTION_ALREADY_ACTIVE', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
      meta: { modelName: 'WorkOrder', target: ['vehicle_id'] },
    })
    vi.mocked(validateEntryTx).mockRejectedValue(p2002)
    mockDb.workOrder.count.mockResolvedValue(1)
    const res = await validateEntry(validForm)
    expect(res).toEqual({ ok: false, error: ENTRY_ERROR_MESSAGES.INSPECTION_ALREADY_ACTIVE })
  })

  it('P2002 NO confirmado (no hay activa real) → se propaga el error técnico', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
      meta: { modelName: 'WorkOrder', target: ['vehicle_id'] },
    })
    vi.mocked(validateEntryTx).mockRejectedValue(p2002)
    mockDb.workOrder.count.mockResolvedValue(0)
    await expect(validateEntry(validForm)).rejects.toBe(p2002)
  })
})

describe('annulEntry', () => {
  it('ADMIN puede anular → ok', async () => {
    const res = await annulEntry({ vehicleId: 'v1', reason: 'DUPLICADO', notes: null })
    expect(res.ok).toBe(true)
    expect(requireAdmin).toHaveBeenCalled()
    expect(annulEntryTx).toHaveBeenCalledOnce()
  })

  it('motivo OTRO sin notas → rechazado ANTES de abrir la tx', async () => {
    const res = await annulEntry({ vehicleId: 'v1', reason: 'OTRO', notes: null })
    expect(res).toEqual({ ok: false, error: ENTRY_ERROR_MESSAGES.ANNULMENT_NOTES_REQUIRED })
    expect(withLockedRoots).not.toHaveBeenCalled()
  })

  it('motivo OTRO con notas → llega a la tx', async () => {
    const res = await annulEntry({ vehicleId: 'v1', reason: 'OTRO', notes: 'detalle' })
    expect(res.ok).toBe(true)
    expect(annulEntryTx).toHaveBeenCalledOnce()
  })

  it('ENTRY_NOT_ACTIVE del núcleo (anulación terminal / doble anulación) se traduce', async () => {
    vi.mocked(annulEntryTx).mockRejectedValue(new EntryError('ENTRY_NOT_ACTIVE'))
    const res = await annulEntry({ vehicleId: 'v1', reason: 'DUPLICADO', notes: null })
    expect(res).toEqual({ ok: false, error: ENTRY_ERROR_MESSAGES.ENTRY_NOT_ACTIVE })
  })
})

describe('setDocumentDisposition', () => {
  it('fija una disposición → upsert + Activity', async () => {
    const res = await setDocumentDisposition({
      vehicleId: 'v1',
      category: 'DNI_VENDEDOR',
      disposition: 'NO_APLICABLE',
    })
    expect(res.ok).toBe(true)
    expect(mockDb.vehicleDocumentRequirementDisposition.upsert).toHaveBeenCalledOnce()
    expect(mockDb.activity.create).toHaveBeenCalledOnce()
  })

  it('disposición null → borra la fila (vuelve a SIN_CLASIFICAR)', async () => {
    const res = await setDocumentDisposition({
      vehicleId: 'v1',
      category: 'DNI_VENDEDOR',
      disposition: null,
    })
    expect(res.ok).toBe(true)
    expect(mockDb.vehicleDocumentRequirementDisposition.deleteMany).toHaveBeenCalledOnce()
    expect(mockDb.vehicleDocumentRequirementDisposition.upsert).not.toHaveBeenCalled()
  })
})
