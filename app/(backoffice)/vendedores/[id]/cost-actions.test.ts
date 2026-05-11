import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    vehicleCost: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    vehicle: { findUnique: vi.fn(), update: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

import { requireAuth, requireAdmin } from '@/lib/auth'
import {
  createVehicleCost,
  deleteVehicleCost,
  updateVehicleEconomics,
  updateNaveLocation,
} from './cost-actions'

const mockAdmin = { id: 'admin-1', role: 'ADMIN' as const, name: 'Admin' }
const mockAgent = { id: 'agent-1', role: 'AGENTE' as const, name: 'Agente' }

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.$transaction.mockImplementation(async (ops: unknown[]) => {
    const results = await Promise.all(ops)
    return results
  })
})

// ─── createVehicleCost ────────────────────────────────────────────────────────

describe('createVehicleCost', () => {
  it('crea el coste y la actividad (admin)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1' })
    mockDb.vehicleCost.create.mockResolvedValue({ id: 'cost-1' })
    mockDb.activity.create.mockResolvedValue({})

    const result = await createVehicleCost('v-1', {
      category: 'LIMPIEZA',
      description: 'Limpieza exterior',
      amount: 80,
    })

    expect(result.ok).toBe(true)
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
  })

  it('rechaza datos inválidos', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)

    const result = await createVehicleCost('v-1', {
      category: 'LIMPIEZA',
      description: '',
      amount: -1,
    })

    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toBe('Datos inválidos')
  })

  it('error si vehículo no existe', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicle.findUnique.mockResolvedValue(null)

    const result = await createVehicleCost('v-unknown', {
      category: 'OTRO',
      description: 'Test',
      amount: 50,
    })

    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toBe('Vehículo no encontrado')
  })
})

// ─── deleteVehicleCost ────────────────────────────────────────────────────────

describe('deleteVehicleCost', () => {
  it('permite al autor borrar su propio coste', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.vehicleCost.findUnique.mockResolvedValue({
      createdById: 'agent-1',
      vehicle: { sellerLeadId: 'sl-1' },
    })
    mockDb.vehicleCost.delete.mockResolvedValue({})

    const result = await deleteVehicleCost('cost-1')
    expect(result.ok).toBe(true)
  })

  it('permite al admin borrar costes de otros', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAdmin)
    mockDb.vehicleCost.findUnique.mockResolvedValue({
      createdById: 'other-user',
      vehicle: { sellerLeadId: 'sl-1' },
    })
    mockDb.vehicleCost.delete.mockResolvedValue({})

    const result = await deleteVehicleCost('cost-1')
    expect(result.ok).toBe(true)
  })

  it('prohíbe a un agente borrar coste de otro', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.vehicleCost.findUnique.mockResolvedValue({
      createdById: 'other-user',
      vehicle: { sellerLeadId: 'sl-1' },
    })

    const result = await deleteVehicleCost('cost-1')
    expect(result.ok).toBe(false)
  })

  it('error si el coste no existe', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAgent)
    mockDb.vehicleCost.findUnique.mockResolvedValue(null)

    const result = await deleteVehicleCost('cost-unknown')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toBe('Coste no encontrado')
  })
})

// ─── updateVehicleEconomics ───────────────────────────────────────────────────

describe('updateVehicleEconomics', () => {
  it('guarda precios y crea actividad (admin)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1' })
    mockDb.vehicle.update.mockResolvedValue({})
    mockDb.activity.create.mockResolvedValue({})

    const result = await updateVehicleEconomics('v-1', {
      purchasePrice: 25000,
      salePrice: 30000,
      marginPercent: 5,
    })

    expect(result.ok).toBe(true)
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
  })

  it('rechaza margen > 100', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)

    const result = await updateVehicleEconomics('v-1', {
      purchasePrice: 25000,
      salePrice: 30000,
      marginPercent: 150,
    })

    expect(result.ok).toBe(false)
  })
})

// ─── updateNaveLocation ───────────────────────────────────────────────────────

describe('updateNaveLocation', () => {
  it('actualiza entryDate y naveLocation', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1' })
    mockDb.vehicle.update.mockResolvedValue({})

    const result = await updateNaveLocation('v-1', {
      entryDate: '2026-05-01',
      naveLocation: 'Fila A, posición 3',
    })

    expect(result.ok).toBe(true)
    expect(mockDb.vehicle.update).toHaveBeenCalledOnce()
  })

  it('acepta null en ambos campos', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
    mockDb.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'sl-1' })
    mockDb.vehicle.update.mockResolvedValue({})

    const result = await updateNaveLocation('v-1', { entryDate: null, naveLocation: null })
    expect(result.ok).toBe(true)
  })
})
