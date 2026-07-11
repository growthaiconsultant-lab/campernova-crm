import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/valuation/save', () => ({ runAndSaveAutoValuation: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/matching', () => ({ recalculateMatchesForVehicle: vi.fn(() => Promise.resolve()) }))

// El servicio atómico se mockea; ConversionConflictError se mantiene REAL (importOriginal).
vi.mock('@/lib/capture-conversion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/capture-conversion')>()
  return { ...actual, convertCaptureTx: vi.fn() }
})

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    vehicleCapture: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { requireAgente } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { runAndSaveAutoValuation } from '@/lib/valuation/save'
import { convertCaptureTx, ConversionConflictError } from '@/lib/capture-conversion'
import { convertCaptureToSellerLead } from './actions'

const capture = {
  id: 'cap-1',
  listingUrl: 'https://coches.net/x',
  phone: '600111222',
  title: 'Adria Coral',
  portal: 'COCHES_NET',
  askingPrice: 30000,
  notes: 'impecable',
  status: 'ENTRADA_AGENDADA',
  assignedToId: 'agent-1',
  sellerLeadId: null as string | null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue({ id: 'agent-1', role: 'AGENTE' } as never)
  mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockDb)
  )
  vi.mocked(convertCaptureTx).mockResolvedValue({ sellerLeadId: 's1', vehicleId: 'v1' })
})

describe('convertCaptureToSellerLead · validaciones e idempotencia', () => {
  it('error si la captación no existe', async () => {
    mockDb.vehicleCapture.findUnique.mockResolvedValue(null)
    const res = await convertCaptureToSellerLead('nope')
    expect(res).toEqual({ error: 'Captación no encontrada' })
    expect(convertCaptureTx).not.toHaveBeenCalled()
  })

  it('idempotente: si ya está convertida devuelve el lead existente sin tocar el servicio', async () => {
    mockDb.vehicleCapture.findUnique.mockResolvedValue({ ...capture, sellerLeadId: 's-existing' })
    const res = await convertCaptureToSellerLead('cap-1')
    expect(res).toEqual({ sellerLeadId: 's-existing' })
    expect(convertCaptureTx).not.toHaveBeenCalled()
  })
})

describe('convertCaptureToSellerLead · conversión atómica', () => {
  it('invoca el servicio y ejecuta tasación/matching/revalidación tras el commit', async () => {
    mockDb.vehicleCapture.findUnique.mockResolvedValue({ ...capture })
    const res = await convertCaptureToSellerLead('cap-1')
    expect(res).toEqual({ sellerLeadId: 's1' })

    const [, params] = vi.mocked(convertCaptureTx).mock.calls[0]
    expect(params.captureId).toBe('cap-1')
    expect(params.sellerData.canal).toBe('CN')
    expect((params.sellerData.vehicle as { create: { brand: string } }).create.brand).toBe('Adria')

    expect(runAndSaveAutoValuation).toHaveBeenCalledWith('v1', expect.any(Object))
    expect(revalidatePath).toHaveBeenCalledWith('/captaciones')
    expect(revalidatePath).toHaveBeenCalledWith('/vendedores')
  })

  it('traduce ConversionConflictError a { error } y NO ejecuta tasación ni revalida', async () => {
    mockDb.vehicleCapture.findUnique.mockResolvedValue({ ...capture })
    vi.mocked(convertCaptureTx).mockRejectedValue(new ConversionConflictError('capture'))

    const res = await convertCaptureToSellerLead('cap-1')
    expect(res).toEqual({ error: 'La captación ya ha sido convertida o su estado ha cambiado.' })
    expect(runAndSaveAutoValuation).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('propaga un error técnico inesperado (no lo oculta) y NO ejecuta efectos', async () => {
    mockDb.vehicleCapture.findUnique.mockResolvedValue({ ...capture })
    vi.mocked(convertCaptureTx).mockRejectedValue(new Error('DB caída'))

    await expect(convertCaptureToSellerLead('cap-1')).rejects.toThrow('DB caída')
    expect(runAndSaveAutoValuation).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
