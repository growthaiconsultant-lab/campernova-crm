import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/matching', () => ({ recalculateMatchesForBuyer: vi.fn() }))

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    buyerLead: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    delivery: { findFirst: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockDb }
})
vi.mock('@/lib/db', () => ({ db: mockDb }))

import type { User } from '@prisma/client'
import { requireAgente } from '@/lib/auth'
import { updateBuyerLead, archiveBuyerLead, addBuyerLeadNote } from './actions'

const admin = { id: 'admin-1', role: 'ADMIN' } as User
const agent = { id: 'agent-1', role: 'AGENTE' } as User

const baseInput = {
  name: 'Ana',
  email: 'ana@example.com',
  phone: '600111222',
  status: 'CONTACTADO' as const,
  agentId: null as string | null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAgente).mockResolvedValue(agent)
  mockDb.activity.create.mockResolvedValue({})
  mockDb.buyerLead.update.mockResolvedValue({})
  mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
    fn(mockDb)
  )
})

describe('updateBuyerLead', () => {
  it('rechaza una transición de estado no permitida (NUEVO → CERRADO)', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'NUEVO', agentId: null, agent: null })
    const res = await updateBuyerLead('b1', { ...baseInput, status: 'CERRADO' })
    expect((res as { error: { formErrors: string[] } }).error.formErrors[0]).toContain(
      'Transición no permitida'
    )
    expect(mockDb.buyerLead.update).not.toHaveBeenCalled()
  })

  it('permite una transición válida (NUEVO → CONTACTADO) y loguea CAMBIO_ESTADO', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'NUEVO', agentId: null, agent: null })
    const res = await updateBuyerLead('b1', baseInput)
    expect(res).toEqual({ ok: true })
    expect(mockDb.buyerLead.update).toHaveBeenCalled()
    const activityTypes = mockDb.activity.create.mock.calls.map((c) => c[0].data.type)
    expect(activityTypes).toContain('CAMBIO_ESTADO')
  })

  it('bloquea el cambio de agente a un AGENTE no admin', async () => {
    vi.mocked(requireAgente).mockResolvedValue(agent)
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'NUEVO', agentId: null, agent: null })
    const res = await updateBuyerLead('b1', { ...baseInput, status: 'NUEVO', agentId: 'other' })
    expect((res as { error: { formErrors: string[] } }).error.formErrors[0]).toContain(
      'Solo el admin'
    )
    expect(mockDb.buyerLead.update).not.toHaveBeenCalled()
  })

  it('permite al ADMIN reasignar y loguea LEAD_ASIGNADO', async () => {
    vi.mocked(requireAgente).mockResolvedValue(admin)
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'NUEVO', agentId: null, agent: null })
    mockDb.user.findUnique.mockResolvedValue({ name: 'Desirée' })
    const res = await updateBuyerLead('b1', { ...baseInput, status: 'NUEVO', agentId: 'agent-9' })
    expect(res).toEqual({ ok: true })
    const activityTypes = mockDb.activity.create.mock.calls.map((c) => c[0].data.type)
    expect(activityTypes).toContain('LEAD_ASIGNADO')
  })

  it('no permite CERRAR sin entrega completada', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({
      status: 'EN_NEGOCIACION',
      agentId: null,
      agent: null,
    })
    mockDb.delivery.findFirst.mockResolvedValue(null)
    const res = await updateBuyerLead('b1', { ...baseInput, status: 'CERRADO' })
    expect((res as { error: { formErrors: string[] } }).error.formErrors[0]).toContain(
      'entrega completada'
    )
  })
})

describe('archiveBuyerLead', () => {
  it('archiva (→ PERDIDO) con motivo y guarda lostReason + notas', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'NUEVO' })
    const res = await archiveBuyerLead('b1', 'PRECIO', 'quería algo más barato')
    expect(res).toEqual({ error: null })
    expect(mockDb.buyerLead.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { status: 'PERDIDO', lostReason: 'PRECIO', lostReasonNotes: 'quería algo más barato' },
    })
    expect(mockDb.activity.create.mock.calls[0][0].data.content).toContain('Motivo: Precio')
  })

  it('rechaza archivar sin motivo (CAM-61)', async () => {
    const res = await archiveBuyerLead('b1')
    expect(res.error).toContain('motivo')
    expect(mockDb.buyerLead.update).not.toHaveBeenCalled()
  })

  it('rechaza un motivo inválido', async () => {
    const res = await archiveBuyerLead('b1', 'INVENTADO')
    expect(res.error).toContain('motivo')
    expect(mockDb.buyerLead.update).not.toHaveBeenCalled()
  })

  it('notas vacías se guardan como null', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'NUEVO' })
    await archiveBuyerLead('b1', 'NO_RESPONDE', '   ')
    expect(mockDb.buyerLead.update.mock.calls[0][0].data.lostReasonNotes).toBeNull()
  })

  it('no archiva un lead en estado terminal CERRADO (CERRADO → PERDIDO inválido)', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'CERRADO' })
    const res = await archiveBuyerLead('b1', 'PRECIO')
    expect(res.error).toContain('estado final')
    expect(mockDb.buyerLead.update).not.toHaveBeenCalled()
  })
})

describe('addBuyerLeadNote', () => {
  it('rechaza nota vacía', async () => {
    const res = await addBuyerLeadNote('b1', '   ')
    expect(res.error).toContain('vacío')
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('rechaza nota de más de 2000 caracteres', async () => {
    const res = await addBuyerLeadNote('b1', 'x'.repeat(2001))
    expect(res.error).toContain('2000')
  })

  it('crea la nota como actividad NOTA', async () => {
    const res = await addBuyerLeadNote('b1', 'Llamada hecha, interesado')
    expect(res).toEqual({ ok: true })
    expect(mockDb.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'NOTA', buyerLeadId: 'b1', agentId: 'agent-1' }),
    })
  })
})
