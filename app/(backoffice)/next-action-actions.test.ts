import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    sellerLead: { findUnique: vi.fn(), update: vi.fn() },
    buyerLead: { findUnique: vi.fn(), update: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { requireAgente } from '@/lib/auth'
import { setNextAction } from './next-action-actions'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue({ id: 'user-1' } as never)
  mockDb.sellerLead.findUnique.mockResolvedValue({ id: 'seller-1' })
  mockDb.buyerLead.findUnique.mockResolvedValue({ id: 'buyer-1' })
  mockDb.$transaction.mockResolvedValue([])
})

describe('setNextAction', () => {
  it('rechaza un tipo de acción inválido', async () => {
    const res = await setNextAction({
      leadType: 'buyer',
      leadId: 'buyer-1',
      type: 'HACKEAR',
      dueAt: null,
    })
    expect(res.error).toBeTruthy()
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('rechaza una fecha inválida', async () => {
    const res = await setNextAction({
      leadType: 'buyer',
      leadId: 'buyer-1',
      type: 'LLAMAR',
      dueAt: 'no-es-fecha',
    })
    expect(res.error).toBeTruthy()
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('devuelve error si el lead no existe', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue(null)
    const res = await setNextAction({
      leadType: 'buyer',
      leadId: 'nope',
      type: 'LLAMAR',
      dueAt: null,
    })
    expect(res.error).toBe('Lead no encontrado')
  })

  it('guarda tipo + fecha en buyer y crea la Activity', async () => {
    const res = await setNextAction({
      leadType: 'buyer',
      leadId: 'buyer-1',
      type: 'AGENDAR_VISITA',
      dueAt: '2026-07-10T10:00:00.000Z',
    })
    expect(res.error).toBeUndefined()
    expect(mockDb.buyerLead.update).toHaveBeenCalledWith({
      where: { id: 'buyer-1' },
      data: {
        nextActionType: 'AGENDAR_VISITA',
        nextActionDueAt: new Date('2026-07-10T10:00:00.000Z'),
      },
    })
    const activityArg = mockDb.activity.create.mock.calls[0][0].data
    expect(activityArg.type).toBe('PROXIMA_ACCION_ACTUALIZADA')
    expect(activityArg.buyerLeadId).toBe('buyer-1')
    expect(activityArg.agentId).toBe('user-1')
    expect(activityArg.content).toContain('Agendar visita')
  })

  it('guarda en seller con sellerLeadId en la Activity', async () => {
    const res = await setNextAction({
      leadType: 'seller',
      leadId: 'seller-1',
      type: 'LLAMAR',
      dueAt: null,
    })
    expect(res.error).toBeUndefined()
    expect(mockDb.sellerLead.update).toHaveBeenCalledWith({
      where: { id: 'seller-1' },
      data: { nextActionType: 'LLAMAR', nextActionDueAt: null },
    })
    expect(mockDb.activity.create.mock.calls[0][0].data.sellerLeadId).toBe('seller-1')
  })

  it('type null limpia acción y fecha', async () => {
    const res = await setNextAction({
      leadType: 'buyer',
      leadId: 'buyer-1',
      type: null,
      dueAt: null,
    })
    expect(res.error).toBeUndefined()
    expect(mockDb.buyerLead.update).toHaveBeenCalledWith({
      where: { id: 'buyer-1' },
      data: { nextActionType: null, nextActionDueAt: null },
    })
    expect(mockDb.activity.create.mock.calls[0][0].data.content).toBe('Próxima acción eliminada')
  })
})
