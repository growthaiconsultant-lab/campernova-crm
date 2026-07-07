import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/matching', () => ({ recalculateMatchesForBuyer: vi.fn() }))

const { mockDb } = vi.hoisted(() => {
  const mockDb = { buyerLead: { create: vi.fn(), findMany: vi.fn() } }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { recalculateMatchesForBuyer } from '@/lib/matching'
import { createBuyerLead } from './actions'

const validInput = {
  name: 'Ana Compradora',
  email: 'ana@example.com',
  phone: '600111222',
  vehicleType: 'CAMPER' as const,
  minSeats: 4,
  maxBudget: 40000,
  useZone: 'Cataluña',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.buyerLead.create.mockResolvedValue({ id: 'buyer-1' })
  mockDb.buyerLead.findMany.mockResolvedValue([]) // sin duplicados por defecto
})

describe('createBuyerLead', () => {
  it('rechaza datos inválidos (email mal formado)', async () => {
    const res = await createBuyerLead({ ...validInput, email: 'no-es-email' })
    expect('error' in res).toBe(true)
    expect(mockDb.buyerLead.create).not.toHaveBeenCalled()
  })

  it('rechaza si falta el nombre', async () => {
    const res = await createBuyerLead({ ...validInput, name: '' })
    expect('error' in res).toBe(true)
    expect(mockDb.buyerLead.create).not.toHaveBeenCalled()
  })

  it('crea el lead con estado NUEVO y sin agente', async () => {
    const res = await createBuyerLead(validInput)
    expect(res).toEqual({ leadId: 'buyer-1' })
    const arg = mockDb.buyerLead.create.mock.calls[0][0].data
    expect(arg.status).toBe('NUEVO')
    expect(arg.agentId).toBeNull()
    expect(arg.name).toBe('Ana Compradora')
  })

  it('aplica defaults de criticalEquipment cuando no se envía', async () => {
    await createBuyerLead(validInput)
    const arg = mockDb.buyerLead.create.mock.calls[0][0].data
    expect(arg.criticalEquipment).toEqual({
      solar: false,
      kitchen: false,
      bathroom: false,
      shower: false,
      heating: false,
    })
  })

  it('recalcula matches tras crear', async () => {
    await createBuyerLead(validInput)
    expect(recalculateMatchesForBuyer).toHaveBeenCalledWith('buyer-1', mockDb)
  })

  it('avisa de duplicado por teléfono y no crea (CAM-66)', async () => {
    mockDb.buyerLead.findMany.mockResolvedValue([
      { id: 'existing', name: 'Ana', phone: '+34 600 11 12 22', status: 'CONTACTADO' },
    ])
    const res = await createBuyerLead({ ...validInput, phone: '0034600111222' })
    expect('duplicate' in res && res.duplicate?.id).toBe('existing')
    expect(mockDb.buyerLead.create).not.toHaveBeenCalled()
  })

  it('con allowDuplicate=true crea aunque exista', async () => {
    mockDb.buyerLead.findMany.mockResolvedValue([
      { id: 'existing', name: 'Ana', phone: '600111222', status: 'NUEVO' },
    ])
    const res = await createBuyerLead(validInput, true)
    expect(res).toEqual({ leadId: 'buyer-1' })
    expect(mockDb.buyerLead.create).toHaveBeenCalled()
  })
})
