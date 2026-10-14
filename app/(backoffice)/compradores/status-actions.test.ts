import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BuyerLeadStatus, User } from '@prisma/client'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAgente: vi.fn() }))
vi.mock('@/lib/matching', () => ({ recalculateMatchesForBuyer: vi.fn() }))
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    buyerLead: { findUnique: vi.fn(), updateMany: vi.fn() },
    delivery: { findFirst: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { requireAgente } from '@/lib/auth'
import { recalculateMatchesForBuyer } from '@/lib/matching'
import { revalidatePath } from 'next/cache'
import { setBuyerStatus } from './status-actions'

const input = { leadId: 'buyer-1', expectedStatus: 'NUEVO', status: 'CONTACTADO' }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(requireAgente).mockResolvedValue({ id: 'agent-1', role: 'AGENTE' } as User)
  mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
    fn(mockDb)
  )
  mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'NUEVO' })
  mockDb.buyerLead.updateMany.mockResolvedValue({ count: 1 })
  mockDb.activity.create.mockResolvedValue({})
})

describe('COM-5 cambio rápido de estado', () => {
  it.each(['ADMIN', 'AGENTE'])(
    'guarda Contactado como %s sin sobrescribir la ficha',
    async (role) => {
      vi.mocked(requireAgente).mockResolvedValue({ id: 'actor-1', role } as User)
      expect(await setBuyerStatus(input)).toEqual({ ok: true })
      expect(mockDb.buyerLead.updateMany).toHaveBeenCalledWith({
        where: { id: 'buyer-1', status: 'NUEVO' },
        data: { status: 'CONTACTADO' },
      })
      expect(mockDb.activity.create).toHaveBeenCalledExactlyOnceWith({
        data: {
          type: 'CAMBIO_ESTADO',
          content: 'Estado cambiado: Nuevo → Contactado',
          agentId: 'actor-1',
          buyerLeadId: 'buyer-1',
        },
      })
      expect(recalculateMatchesForBuyer).toHaveBeenCalledWith('buyer-1', mockDb)
      expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual([
        '/compradores/buyer-1',
        '/compradores',
        '/compradores/pipeline',
      ])
    }
  )

  it.each([
    null,
    {},
    { ...input, leadId: '' },
    { ...input, status: 'INVENTADO' },
    { ...input, expectedStatus: 'INVENTADO' },
  ])('rechaza una entrada inválida %j antes de leer datos', async (data) => {
    expect(await setBuyerStatus(data)).toHaveProperty('error')
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it('autoriza antes de validar o acceder a datos', async () => {
    vi.mocked(requireAgente).mockRejectedValue(new Error('No autorizado'))
    await expect(setBuyerStatus(input)).rejects.toThrow('No autorizado')
    expect(mockDb.$transaction).not.toHaveBeenCalled()
    expect(mockDb.buyerLead.updateMany).not.toHaveBeenCalled()
  })

  it('devuelve error si el comprador no existe', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue(null)
    expect(await setBuyerStatus(input)).toEqual({ error: 'Comprador no encontrado' })
    expect(mockDb.buyerLead.updateMany).not.toHaveBeenCalled()
  })

  it.each([
    'NO_CONTESTA',
    'CONTACTADO',
    'CUALIFICADO',
    'EN_NEGOCIACION',
    'PERDIDO',
  ] as BuyerLeadStatus[])('conserva los destinos actuales: %s', async (status) => {
    expect(await setBuyerStatus({ ...input, status })).toEqual({ ok: true })
    expect(mockDb.buyerLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status } })
    )
  })

  it('permite corregir una clasificación perdida', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'PERDIDO' })
    expect(await setBuyerStatus({ ...input, expectedStatus: 'PERDIDO' })).toEqual({ ok: true })
  })
  it('corrige No contesta a Contactado y deja traza del salto', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'NO_CONTESTA' })
    expect(await setBuyerStatus({ ...input, expectedStatus: 'NO_CONTESTA' })).toEqual({ ok: true })
    expect(mockDb.activity.create.mock.calls[0][0].data.content).toBe(
      'Estado cambiado: No contesta → Contactado'
    )
  })

  it('un reintento del mismo destino no duplica actividad', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'CONTACTADO' })
    expect(await setBuyerStatus(input)).toEqual({ ok: true })
    expect(mockDb.buyerLead.updateMany).not.toHaveBeenCalled()
    expect(mockDb.activity.create).not.toHaveBeenCalled()
    expect(recalculateMatchesForBuyer).not.toHaveBeenCalled()
  })

  it('rechaza el estado obsoleto antes de escribir', async () => {
    mockDb.buyerLead.findUnique.mockResolvedValue({ status: 'EN_NEGOCIACION' })
    expect(await setBuyerStatus(input)).toHaveProperty('error')
    expect(mockDb.buyerLead.updateMany).not.toHaveBeenCalled()
    expect(mockDb.activity.create).not.toHaveBeenCalled()
  })

  it('un CAS perdido no crea actividad ni recalcula matching', async () => {
    mockDb.buyerLead.updateMany.mockResolvedValue({ count: 0 })
    expect(await setBuyerStatus(input)).toHaveProperty('error')
    expect(mockDb.activity.create).not.toHaveBeenCalled()
    expect(recalculateMatchesForBuyer).not.toHaveBeenCalled()
  })

  it('bloquea Cerrado sin entrega de venta completada', async () => {
    mockDb.delivery.findFirst.mockResolvedValue(null)
    expect(await setBuyerStatus({ ...input, status: 'CERRADO' })).toHaveProperty('error')
    expect(mockDb.delivery.findFirst).toHaveBeenCalledWith({
      where: { buyerLeadId: 'buyer-1', kind: 'VENTA', status: 'COMPLETADA' },
      select: { id: true },
    })
    expect(mockDb.buyerLead.updateMany).not.toHaveBeenCalled()
  })

  it('permite Cerrado con entrega de venta completada', async () => {
    mockDb.delivery.findFirst.mockResolvedValue({ id: 'delivery-1' })
    expect(await setBuyerStatus({ ...input, status: 'CERRADO' })).toEqual({ ok: true })
  })

  it('propaga fallo transaccional sin invalidar ni recalcular', async () => {
    mockDb.activity.create.mockRejectedValue(new Error('Activity failed'))
    await expect(setBuyerStatus(input)).rejects.toThrow('Activity failed')
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(recalculateMatchesForBuyer).not.toHaveBeenCalled()
  })
})
