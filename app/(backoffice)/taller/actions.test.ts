import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    workOrder: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    workOrderChecklist: { update: vi.fn(), findUnique: vi.fn() },
    workOrderTimeEntry: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    workOrderPart: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    vehicleCost: { create: vi.fn() },
    vehicle: { findUnique: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireAuth, requireAdmin } from '@/lib/auth'
import {
  createWorkOrder,
  updateWorkOrderStatus,
  addTimeEntry,
  deleteTimeEntry,
  addPart,
  deletePart,
  approveWorkOrder,
} from './actions'

const mockAdmin = { id: 'admin-1', role: 'ADMIN' as const, name: 'Admin' } as unknown as User
const mockAgent = { id: 'agent-1', role: 'AGENTE' as const, name: 'Agente' } as unknown as User

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.$transaction.mockImplementation(async (ops: unknown[]) => {
    const results = await Promise.all(ops)
    return results
  })
})

// ─── createWorkOrder ──────────────────────────────────────────────────────────

describe('createWorkOrder', () => {
  it('crea la orden con checklist de 21 ítems (no requiere aprobación)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.vehicle.findUnique.mockResolvedValue({
      sellerLeadId: 'sl-1',
      brand: 'Bürstner',
      model: 'Lyseo',
    })
    mockDb.workOrder.create.mockResolvedValue({ id: 'wo-1' })
    mockDb.activity.create.mockResolvedValue({})

    const result = await createWorkOrder({
      vehicleId: 'v-1',
      description: 'Revisión pre-venta',
      estimatedCost: 300,
      approvalLimit: 500,
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data!.id).toBe('wo-1')

    const createCall = mockDb.workOrder.create.mock.calls[0][0]
    expect(createCall.data.approvalLevel).toBe('NO_REQUIERE')
    expect(createCall.data.checklist.create).toHaveLength(21)
  })

  it('marca REQUIERE_CEO si estimatedCost > approvalLimit', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.vehicle.findUnique.mockResolvedValue({
      sellerLeadId: 'sl-1',
      brand: 'Bürstner',
      model: 'Lyseo',
    })
    mockDb.workOrder.create.mockResolvedValue({ id: 'wo-2' })
    mockDb.activity.create.mockResolvedValue({})

    await createWorkOrder({
      vehicleId: 'v-1',
      description: 'Reforma completa',
      estimatedCost: 1200,
      approvalLimit: 500,
    })

    const createCall = mockDb.workOrder.create.mock.calls[0][0]
    expect(createCall.data.approvalLevel).toBe('REQUIERE_CEO')
  })

  it('rechaza si vehicleId es vacío', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)

    const result = await createWorkOrder({
      vehicleId: '',
      description: 'Test',
    })

    expect(result.ok).toBe(false)
  })

  it('error si vehículo no existe', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.vehicle.findUnique.mockResolvedValue(null)

    const result = await createWorkOrder({ vehicleId: 'v-unknown', description: 'Test' })
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toBe('Vehículo no encontrado')
  })
})

// ─── updateWorkOrderStatus ────────────────────────────────────────────────────

describe('updateWorkOrderStatus', () => {
  const baseWo = {
    status: 'PENDIENTE' as const,
    approvalLevel: 'NO_REQUIERE' as const,
    vehicleId: 'v-1',
    vehicle: { sellerLeadId: 'sl-1' },
    timeEntries: [],
    parts: [],
  }

  it('transición válida: PENDIENTE → EN_DIAGNOSTICO', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.workOrder.findUnique.mockResolvedValue(baseWo)
    mockDb.workOrder.update.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    const result = await updateWorkOrderStatus('wo-1', 'EN_DIAGNOSTICO')
    expect(result.ok).toBe(true)
  })

  it('transición inválida: PENDIENTE → COMPLETADA', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.workOrder.findUnique.mockResolvedValue(baseWo)

    const result = await updateWorkOrderStatus('wo-1', 'COMPLETADA')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toContain('no permitida')
  })

  it('bloquea EN_CURSO si requiere aprobación CEO', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.workOrder.findUnique.mockResolvedValue({
      ...baseWo,
      status: 'PRESUPUESTADA' as const,
      approvalLevel: 'REQUIERE_CEO' as const,
    })

    const result = await updateWorkOrderStatus('wo-1', 'EN_CURSO')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toContain('aprobación del CEO')
  })

  it('genera VehicleCost MANO_OBRA_TALLER y PIEZAS al COMPLETADA', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.workOrder.findUnique.mockResolvedValue({
      ...baseWo,
      status: 'EN_CURSO' as const,
      timeEntries: [{ hours: 3, hourlyRate: 30 }],
      parts: [{ quantity: 2, unitCost: 50 }],
    })
    mockDb.workOrder.update.mockResolvedValue({})
    mockDb.vehicleCost.create.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    const result = await updateWorkOrderStatus('wo-1', 'COMPLETADA')
    expect(result.ok).toBe(true)

    // Should have created 2 vehicle costs (mano obra + piezas) + 1 activity
    // All inside the $transaction call
    const transactionArgs = mockDb.$transaction.mock.calls[0][0] as unknown[]
    // 1 workOrder.update + 2 vehicleCost.create + 1 activity.create = 4 ops
    expect(transactionArgs).toHaveLength(4)
  })

  it('no genera VehicleCost si no hay horas ni piezas al COMPLETADA', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.workOrder.findUnique.mockResolvedValue({
      ...baseWo,
      status: 'EN_CURSO' as const,
      timeEntries: [],
      parts: [],
    })
    mockDb.workOrder.update.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    const result = await updateWorkOrderStatus('wo-1', 'COMPLETADA')
    expect(result.ok).toBe(true)

    const transactionArgs = mockDb.$transaction.mock.calls[0][0] as unknown[]
    // Only workOrder.update + activity = 2 ops
    expect(transactionArgs).toHaveLength(2)
  })
})

// ─── addTimeEntry ─────────────────────────────────────────────────────────────

describe('addTimeEntry', () => {
  it('imputa horas correctamente', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.workOrder.findUnique.mockResolvedValue({ status: 'EN_CURSO' })
    mockDb.workOrderTimeEntry.create.mockResolvedValue({})

    const result = await addTimeEntry('wo-1', {
      hours: 2,
      hourlyRate: 30,
      description: 'Revisión motor',
      workDate: '2026-05-12',
    })

    expect(result.ok).toBe(true)
    expect(mockDb.workOrderTimeEntry.create).toHaveBeenCalledOnce()
  })

  it('bloquea imputar horas en orden COMPLETADA', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.workOrder.findUnique.mockResolvedValue({ status: 'COMPLETADA' })

    const result = await addTimeEntry('wo-1', {
      hours: 1,
      hourlyRate: 30,
      description: 'Test',
      workDate: '2026-05-12',
    })

    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toContain('cerrada')
  })
})

// ─── deleteTimeEntry ──────────────────────────────────────────────────────────

describe('deleteTimeEntry', () => {
  it('el trabajador puede borrar su propia entrada', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.workOrderTimeEntry.findUnique.mockResolvedValue({
      workerId: 'agent-1',
      workOrderId: 'wo-1',
    })
    mockDb.workOrderTimeEntry.delete.mockResolvedValue({})

    const result = await deleteTimeEntry('entry-1')
    expect(result.ok).toBe(true)
  })

  it('bloquea a un agente borrar entrada ajena', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.workOrderTimeEntry.findUnique.mockResolvedValue({
      workerId: 'other-worker',
      workOrderId: 'wo-1',
    })

    const result = await deleteTimeEntry('entry-1')
    expect(result.ok).toBe(false)
  })

  it('el admin puede borrar cualquier entrada', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAdmin)
    mockDb.workOrderTimeEntry.findUnique.mockResolvedValue({
      workerId: 'other-worker',
      workOrderId: 'wo-1',
    })
    mockDb.workOrderTimeEntry.delete.mockResolvedValue({})

    const result = await deleteTimeEntry('entry-1')
    expect(result.ok).toBe(true)
  })
})

// ─── addPart / deletePart ─────────────────────────────────────────────────────

describe('addPart', () => {
  it('añade pieza correctamente', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.workOrderPart.create.mockResolvedValue({})

    const result = await addPart('wo-1', { name: 'Filtro aceite', quantity: 1, unitCost: 25 })
    expect(result.ok).toBe(true)
  })

  it('rechaza datos inválidos', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)

    const result = await addPart('wo-1', { name: '', quantity: 0, unitCost: -5 })
    expect(result.ok).toBe(false)
  })
})

describe('deletePart', () => {
  it('solo admin puede borrar piezas', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.workOrderPart.findUnique.mockResolvedValue({ workOrderId: 'wo-1' })
    mockDb.workOrderPart.delete.mockResolvedValue({})

    const result = await deletePart('part-1')
    expect(result.ok).toBe(true)
  })
})

// ─── approveWorkOrder ─────────────────────────────────────────────────────────

describe('approveWorkOrder', () => {
  it('admin puede aprobar presupuesto', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.workOrder.findUnique.mockResolvedValue({
      approvalLevel: 'REQUIERE_CEO',
      vehicle: { sellerLeadId: 'sl-1' },
    })
    mockDb.workOrder.update.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    const result = await approveWorkOrder('wo-1')
    expect(result.ok).toBe(true)

    const updateCall = mockDb.workOrder.update.mock.calls[0][0]
    expect(updateCall.data.approvalLevel).toBe('APROBADA_CEO')
    expect(updateCall.data.approvedById).toBe('admin-1')
  })
})
