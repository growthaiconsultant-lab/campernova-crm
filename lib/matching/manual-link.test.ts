import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { createOrPinManualMatch } from './manual-link'

function makeTx(options?: {
  existing?: { id: string; manualLinkedAt: Date | null } | null
  sellerArchivedAt?: Date | null
  buyerArchivedAt?: Date | null
  updateCount?: number
}) {
  const tx = {
    vehicle: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'vehicle-1',
        sellerLeadId: 'seller-1',
        sellerLead: { archivedAt: options?.sellerArchivedAt ?? null },
      }),
    },
    buyerLead: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'buyer-1',
        archivedAt: options?.buyerArchivedAt ?? null,
      }),
    },
    match: {
      findUnique: vi.fn().mockResolvedValue(options?.existing ?? null),
      create: vi.fn().mockResolvedValue({ id: 'match-new' }),
      updateMany: vi.fn().mockResolvedValue({ count: options?.updateCount ?? 1 }),
    },
    activity: { create: vi.fn().mockResolvedValue({}) },
  }
  return tx
}

const params = {
  vehicleId: 'vehicle-1',
  buyerLeadId: 'buyer-1',
  resolvedSellerLeadId: 'seller-1',
  actorId: 'agent-1',
  reason: 'INTERES_COMPRADOR' as const,
  notes: 'Seguimiento de prueba',
  now: new Date('2026-08-08T10:00:00Z'),
}

describe('createOrPinManualMatch', () => {
  it('crea una relación manual sin score y dos Activities', async () => {
    const tx = makeTx()

    const result = await createOrPinManualMatch(tx as unknown as Prisma.TransactionClient, params)

    expect(result).toEqual({ status: 'created', matchId: 'match-new', sellerLeadId: 'seller-1' })
    expect(tx.match.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: 'vehicle-1',
        buyerLeadId: 'buyer-1',
        score: null,
        generatedBy: 'manual',
        manualLinkedById: 'agent-1',
      }),
      select: { id: true },
    })
    expect(tx.activity.create).toHaveBeenCalledTimes(2)
  })

  it('fija un match automático existente sin crear otro', async () => {
    const tx = makeTx({ existing: { id: 'match-auto', manualLinkedAt: null } })

    const result = await createOrPinManualMatch(tx as unknown as Prisma.TransactionClient, params)

    expect(result).toEqual({ status: 'pinned', matchId: 'match-auto', sellerLeadId: 'seller-1' })
    expect(tx.match.updateMany).toHaveBeenCalledWith({
      where: { id: 'match-auto', manualLinkedAt: null },
      data: expect.objectContaining({ manualLinkReason: 'INTERES_COMPRADOR' }),
    })
    expect(tx.match.create).not.toHaveBeenCalled()
    expect(tx.activity.create).toHaveBeenCalledTimes(2)
  })

  it('es idempotente si la pareja ya estaba fijada', async () => {
    const tx = makeTx({
      existing: { id: 'match-manual', manualLinkedAt: new Date('2026-08-01') },
    })

    const result = await createOrPinManualMatch(tx as unknown as Prisma.TransactionClient, params)

    expect(result.status).toBe('already_linked')
    expect(tx.match.create).not.toHaveBeenCalled()
    expect(tx.match.updateMany).not.toHaveBeenCalled()
    expect(tx.activity.create).not.toHaveBeenCalled()
  })

  it('no vincula un comprador archivado', async () => {
    const tx = makeTx({ buyerArchivedAt: new Date('2026-08-01') })

    const result = await createOrPinManualMatch(tx as unknown as Prisma.TransactionClient, params)

    expect(result).toEqual({ status: 'archived' })
    expect(tx.match.create).not.toHaveBeenCalled()
  })

  it('un CAS perdido no duplica Activities', async () => {
    const tx = makeTx({
      existing: { id: 'match-auto', manualLinkedAt: null },
      updateCount: 0,
    })

    const result = await createOrPinManualMatch(tx as unknown as Prisma.TransactionClient, params)

    expect(result.status).toBe('already_linked')
    expect(tx.activity.create).not.toHaveBeenCalled()
  })
})
