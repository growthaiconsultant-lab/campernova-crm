import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/matching', () => ({ recalculateMatchesForBuyer: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    buyerLead: { create: vi.fn(), findMany: vi.fn() },
    kpiEvent: { create: vi.fn() },
  }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { recalculateMatchesForBuyer } from '@/lib/matching'
import { requireAgente } from '@/lib/auth'
import { createBuyerLead } from './actions'
import { revalidatePath } from 'next/cache'

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
  vi.mocked(requireAgente).mockResolvedValue({ id: 'agent-1' } as never)
  mockDb.buyerLead.create.mockResolvedValue({ id: 'buyer-1' })
  mockDb.buyerLead.findMany.mockResolvedValue([]) // sin duplicados por defecto
})

describe('createBuyerLead', () => {
  it.each(['INSTAGRAM', 'PRESENCIAL', null])(
    'guarda source %s y refresca el listado',
    async (source) => {
      expect(await createBuyerLead({ ...validInput, source })).toEqual({ leadId: 'buyer-1' })
      expect(mockDb.buyerLead.create.mock.calls[0][0].data.source).toBe(source)
      expect(revalidatePath).toHaveBeenCalledWith('/compradores')
      expect(mockDb.kpiEvent.create.mock.calls[0][0].data.source).toBe('ui')
    }
  )
  it('rechaza origen inválido antes de buscar duplicados', async () => {
    expect(await createBuyerLead({ ...validInput, source: 'INVENTADO' })).toHaveProperty('error')
    expect(mockDb.buyerLead.findMany).not.toHaveBeenCalled()
    expect(mockDb.buyerLead.create).not.toHaveBeenCalled()
  })
  it('rechaza datos inválidos (email mal formado)', async () => {
    const res = await createBuyerLead({ ...validInput, email: 'no-es-email' })
    expect('error' in res).toBe(true)
    expect(mockDb.buyerLead.create).not.toHaveBeenCalled()
  })

  // CAP-1 deja FUERA de alcance a BuyerLead: el contacto del comprador sigue siendo obligatorio.
  it('rechaza si falta el nombre (no-regresión CAP-1: comprador conserva sus reglas)', async () => {
    const res = await createBuyerLead({ ...validInput, name: '' })
    expect('error' in res).toBe(true)
    expect(mockDb.buyerLead.create).not.toHaveBeenCalled()
  })

  it('rechaza si falta el teléfono (no-regresión CAP-1)', async () => {
    const res = await createBuyerLead({ ...validInput, phone: '' })
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
