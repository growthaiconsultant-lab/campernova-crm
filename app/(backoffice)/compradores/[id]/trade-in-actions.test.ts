import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/valuation/save', () => ({ runAndSaveAutoValuation: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/matching', () => ({ recalculateMatchesForVehicle: vi.fn(() => Promise.resolve()) }))

// El servicio atómico se mockea; ConversionConflictError se mantiene REAL (importOriginal).
vi.mock('@/lib/capture-conversion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/capture-conversion')>()
  return { ...actual, convertTradeInTx: vi.fn() }
})

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    buyerLead: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { requireAgente } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { runAndSaveAutoValuation } from '@/lib/valuation/save'
import { convertTradeInTx, ConversionConflictError } from '@/lib/capture-conversion'
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
  tradeInSellerLeadId: null as string | null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue({ id: 'agent-1', role: 'AGENTE' } as never)
  mockDb.buyerLead.update.mockResolvedValue({})
  mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockDb)
  )
  vi.mocked(convertTradeInTx).mockResolvedValue({ sellerLeadId: 's1', vehicleId: 'v1' })
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

describe('createSellerLeadFromTradeIn · validaciones previas', () => {
  it('rechaza si el trade-in no es camper/autocaravana', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ ...eligibleBuyer, tradeInType: 'COCHE' })
    const res = await createSellerLeadFromTradeIn('b1')
    expect(res.error).toContain('camper o autocaravana')
    expect(convertTradeInTx).not.toHaveBeenCalled()
  })

  it('rechaza si ya existe un lead de vendedor vinculado (idempotencia secuencial)', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({
      ...eligibleBuyer,
      tradeInSellerLeadId: 's-existing',
    })
    const res = await createSellerLeadFromTradeIn('b1')
    expect(res.error).toContain('Ya existe')
    expect(convertTradeInTx).not.toHaveBeenCalled()
  })

  it('rechaza si faltan marca/modelo/año/km', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ ...eligibleBuyer, tradeInKm: null })
    const res = await createSellerLeadFromTradeIn('b1')
    expect(res.error).toContain('Completa')
    expect(convertTradeInTx).not.toHaveBeenCalled()
  })
})

describe('createSellerLeadFromTradeIn · conversión atómica', () => {
  it('crea el lead de vendedor desde una camper elegible vía el servicio y enriquece tras el commit', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue(eligibleBuyer)
    const res = await createSellerLeadFromTradeIn('b1')
    expect(res).toEqual({ sellerLeadId: 's1' })

    const [, params] = vi.mocked(convertTradeInTx).mock.calls[0]
    expect(params.buyerLeadId).toBe('b1')
    expect(params.sellerData.canal).toBe('CN')
    expect(
      (params.sellerData.vehicle as { create: { type: string; brand: string } }).create.type
    ).toBe('CAMPER')
    expect((params.sellerData.vehicle as { create: { brand: string } }).create.brand).toBe('VW')

    expect(runAndSaveAutoValuation).toHaveBeenCalledWith('v1', expect.any(Object))
    expect(revalidatePath).toHaveBeenCalledWith('/vendedores')
  })

  it('traduce ConversionConflictError a { error } y NO ejecuta tasación ni revalida', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue(eligibleBuyer)
    vi.mocked(convertTradeInTx).mockRejectedValue(new ConversionConflictError('tradein'))

    const res = await createSellerLeadFromTradeIn('b1')
    expect(res).toEqual({
      error: 'El vehículo entregado como parte de pago ya ha sido procesado.',
    })
    expect(runAndSaveAutoValuation).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('propaga un error técnico inesperado (no lo oculta) y NO ejecuta efectos', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue(eligibleBuyer)
    vi.mocked(convertTradeInTx).mockRejectedValue(new Error('DB caída'))

    await expect(createSellerLeadFromTradeIn('b1')).rejects.toThrow('DB caída')
    expect(runAndSaveAutoValuation).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
