import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { TicketTransitionError, transitionTicketTx } from './transition-ticket'

function makeTx(overrides: Record<string, unknown> = {}) {
  const ticket = {
    status: 'RESUELTO',
    title: 'Fuga en el boiler',
    costReal: 150,
    resolvedAt: new Date('2026-08-01T10:00:00Z'),
    warranty: {
      id: 'w1',
      vehicleId: 'v1',
      buyerLeadId: 'b1',
      vehicle: { sellerLeadId: 's1' },
    },
    cost: null,
    ...overrides,
  }
  const tx = {
    postventaTicket: {
      findUnique: vi.fn().mockResolvedValue(ticket),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    vehicleCost: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    activity: { create: vi.fn().mockResolvedValue({}) },
  }
  return { tx: tx as unknown as Prisma.TransactionClient, mocks: tx }
}

describe('transitionTicketTx', () => {
  it('cierra y proyecta el coste real por clave única del ticket', async () => {
    const { tx, mocks } = makeTx()
    await transitionTicketTx(tx, {
      ticketId: 't1',
      expectedCurrentStatus: 'RESUELTO',
      target: 'CERRADO',
      kind: 'forward',
      actorId: 'u1',
    })
    expect(mocks.vehicleCost.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { postventaTicketId: 't1' },
        create: expect.objectContaining({ amount: 150 }),
        update: expect.objectContaining({ amount: 150 }),
      })
    )
  })

  it('al reabrir conserva el último coste contabilizado', async () => {
    const { tx, mocks } = makeTx({ status: 'CERRADO', cost: { amount: 150 } })
    await transitionTicketTx(tx, {
      ticketId: 't1',
      expectedCurrentStatus: 'CERRADO',
      target: 'RESUELTO',
      kind: 'reopen',
      actorId: 'admin',
      reason: 'El cliente vuelve a reportar la incidencia',
    })
    expect(mocks.vehicleCost.upsert).not.toHaveBeenCalled()
    expect(mocks.vehicleCost.deleteMany).not.toHaveBeenCalled()
  })

  it('retira la proyección en el siguiente cierre si el coste real queda vacío', async () => {
    const { tx, mocks } = makeTx({ costReal: null, cost: { amount: 150 } })
    await transitionTicketTx(tx, {
      ticketId: 't1',
      expectedCurrentStatus: 'RESUELTO',
      target: 'CERRADO',
      kind: 'forward',
      actorId: 'u1',
    })
    expect(mocks.vehicleCost.deleteMany).toHaveBeenCalledWith({
      where: { postventaTicketId: 't1' },
    })
    expect(mocks.vehicleCost.upsert).not.toHaveBeenCalled()
  })

  it('exige motivo en una corrección', async () => {
    const { tx } = makeTx()
    await expect(
      transitionTicketTx(tx, {
        ticketId: 't1',
        expectedCurrentStatus: 'RESUELTO',
        target: 'EN_PROGRESO',
        kind: 'correction',
        actorId: 'u1',
      })
    ).rejects.toMatchObject({
      code: 'CORRECTION_REASON_REQUIRED',
    } satisfies Partial<TicketTransitionError>)
  })

  it('no repite escrituras si el estado ya coincide', async () => {
    const { tx, mocks } = makeTx({ status: 'CERRADO' })
    const result = await transitionTicketTx(tx, {
      ticketId: 't1',
      expectedCurrentStatus: 'RESUELTO',
      target: 'CERRADO',
      kind: 'forward',
      actorId: 'u1',
    })
    expect(result.changed).toBe(false)
    expect(mocks.postventaTicket.updateMany).not.toHaveBeenCalled()
    expect(mocks.activity.create).not.toHaveBeenCalled()
  })

  it('rechaza un estado distinto del observado antes del lock', async () => {
    const { tx, mocks } = makeTx({ status: 'EN_PROGRESO' })
    await expect(
      transitionTicketTx(tx, {
        ticketId: 't1',
        expectedCurrentStatus: 'ABIERTO',
        target: 'ANULADO',
        kind: 'forward',
        actorId: 'u1',
      })
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT' } satisfies Partial<TicketTransitionError>)
    expect(mocks.postventaTicket.updateMany).not.toHaveBeenCalled()
  })
})
