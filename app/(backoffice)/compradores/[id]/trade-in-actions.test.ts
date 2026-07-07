import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/valuation/save', () => ({ runAndSaveAutoValuation: vi.fn() }))
vi.mock('@/lib/matching', () => ({ recalculateMatchesForVehicle: vi.fn() }))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    buyerLead: { findUnique: vi.fn(), update: vi.fn() },
    sellerLead: { create: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { requireAgente } from '@/lib/auth'
import { updateTradeIn, createSellerLeadFromTradeIn } from './trade-in-actions'

const eligibleBuyer = {
  id: 'b1',
  name: 'Ana',
  email: 'ana@example.com',
  phone: '600111222',
  hasTradeIn: true,
  tradeInType: 'CAMPER',
  tradeInBrand: 'VW',
  tradeInModel: 'California',
  tradeInYear: 2019,
  tradeInKm: 80000,
  tradeInNotes: 'impecable',
  tradeInSellerLeadId: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue({ id: 'agent-1', role: 'AGENTE' } as never)
  mockDb.buyerLead.update.mockResolvedValue({})
  mockDb.activity.create.mockResolvedValue({})
  mockDb.sellerLead.create.mockResolvedValue({ id: 's1', vehicle: { id: 'v1' } })
  mockDb.$transaction.mockResolvedValue([])
})

describe('updateTradeIn', () => {
  it('rechaza un tipo inválido cuando hasTradeIn=true', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ id: 'b1' })
    const res = await updateTradeIn('b1', {
      hasTradeIn: true,
      type: 'BARCO',
      brand: null,
      model: null,
      year: null,
      km: null,
      financePending: false,
      notes: null,
    })
    expect(res.error).toContain('no válido')
    expect(mockDb.buyerLead.update).not.toHaveBeenCalled()
  })

  it('al desactivar limpia los campos', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ id: 'b1' })
    await updateTradeIn('b1', {
      hasTradeIn: false,
      type: null,
      brand: null,
      model: null,
      year: null,
      km: null,
      financePending: false,
      notes: null,
    })
    const data = mockDb.buyerLead.update.mock.calls[0][0].data
    expect(data.hasTradeIn).toBe(false)
    expect(data.tradeInType).toBeNull()
    expect(data.tradeInBrand).toBeNull()
  })
})

describe('createSellerLeadFromTradeIn', () => {
  it('crea el lead de vendedor desde una camper elegible y lo vincula', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue(eligibleBuyer)
    const res = await createSellerLeadFromTradeIn('b1')
    expect(res.sellerLeadId).toBe('s1')
    const createArg = mockDb.sellerLead.create.mock.calls[0][0]
    expect(createArg.data.canal).toBe('CN')
    expect(createArg.data.vehicle.create.type).toBe('CAMPER')
    expect(createArg.data.vehicle.create.brand).toBe('VW')
    // Vincula el buyer con el seller creado
    expect(mockDb.$transaction).toHaveBeenCalled()
  })

  it('rechaza si el trade-in no es camper/autocaravana', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ ...eligibleBuyer, tradeInType: 'COCHE' })
    const res = await createSellerLeadFromTradeIn('b1')
    expect(res.error).toContain('camper o autocaravana')
    expect(mockDb.sellerLead.create).not.toHaveBeenCalled()
  })

  it('rechaza si ya existe un lead de vendedor vinculado', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({
      ...eligibleBuyer,
      tradeInSellerLeadId: 's-existing',
    })
    const res = await createSellerLeadFromTradeIn('b1')
    expect(res.error).toContain('Ya existe')
    expect(mockDb.sellerLead.create).not.toHaveBeenCalled()
  })

  it('rechaza si faltan marca/modelo/año/km', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ ...eligibleBuyer, tradeInKm: null })
    const res = await createSellerLeadFromTradeIn('b1')
    expect(res.error).toContain('Completa')
    expect(mockDb.sellerLead.create).not.toHaveBeenCalled()
  })
})
