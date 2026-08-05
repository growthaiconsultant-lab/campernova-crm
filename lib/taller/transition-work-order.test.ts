import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { transitionWorkOrderTx, WorkOrderTransitionError } from './transition-work-order'

function makeTx(overrides: Record<string, unknown> = {}) {
  const order = {
    status: 'EN_CURSO',
    kind: 'REPARACION',
    approvalLevel: 'NO_REQUIERE',
    vehicleId: 'v1',
    startedAt: new Date('2026-08-01T10:00:00Z'),
    vehicle: { sellerLeadId: 's1' },
    timeEntries: [{ hours: 2, hourlyRate: 30 }],
    parts: [{ quantity: 2, unitCost: 20 }],
    costs: [],
    ...overrides,
  }
  const tx = {
    workOrder: {
      findUnique: vi.fn().mockResolvedValue(order),
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

describe('transitionWorkOrderTx', () => {
  it('completa y proyecta mano de obra y piezas de forma idempotente', async () => {
    const { tx, mocks } = makeTx()
    const result = await transitionWorkOrderTx(tx, {
      workOrderId: 'wo1',
      expectedCurrentStatus: 'EN_CURSO',
      target: 'COMPLETADA',
      kind: 'forward',
      actorId: 'u1',
    })

    expect(result.status).toBe('COMPLETADA')
    expect(mocks.workOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'wo1', status: 'EN_CURSO' } })
    )
    expect(mocks.vehicleCost.upsert).toHaveBeenCalledTimes(2)
    expect(mocks.vehicleCost.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workOrderId_category: { workOrderId: 'wo1', category: 'MANO_OBRA_TALLER' } },
        create: expect.objectContaining({ amount: 60 }),
        update: expect.objectContaining({ amount: 60 }),
      })
    )
    expect(mocks.activity.create).toHaveBeenCalledTimes(1)
  })

  it('al reabrir conserva la proyección contable existente', async () => {
    const { tx, mocks } = makeTx({
      status: 'COMPLETADA',
      costs: [{ amount: 100 }],
    })
    await transitionWorkOrderTx(tx, {
      workOrderId: 'wo1',
      expectedCurrentStatus: 'COMPLETADA',
      target: 'EN_CURSO',
      kind: 'reopen',
      actorId: 'admin',
      reason: 'Faltó revisar una pieza',
    })

    expect(mocks.vehicleCost.upsert).not.toHaveBeenCalled()
    expect(mocks.vehicleCost.deleteMany).not.toHaveBeenCalled()
    expect(mocks.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: expect.stringContaining('Motivo') }),
      })
    )
  })

  it('rechaza reapertura de inspección de entrada', async () => {
    const { tx } = makeTx({ status: 'COMPLETADA', kind: 'INSPECCION_ENTRADA' })
    await expect(
      transitionWorkOrderTx(tx, {
        workOrderId: 'wo1',
        expectedCurrentStatus: 'COMPLETADA',
        target: 'EN_CURSO',
        kind: 'reopen',
        actorId: 'admin',
        reason: 'Corrección',
      })
    ).rejects.toMatchObject({
      code: 'INSPECTION_TERMINAL',
    } satisfies Partial<WorkOrderTransitionError>)
  })

  it('no duplica efectos cuando el estado objetivo ya está aplicado', async () => {
    const { tx, mocks } = makeTx({ status: 'COMPLETADA' })
    const result = await transitionWorkOrderTx(tx, {
      workOrderId: 'wo1',
      expectedCurrentStatus: 'EN_CURSO',
      target: 'COMPLETADA',
      kind: 'forward',
      actorId: 'u1',
    })
    expect(result.changed).toBe(false)
    expect(mocks.workOrder.updateMany).not.toHaveBeenCalled()
    expect(mocks.vehicleCost.upsert).not.toHaveBeenCalled()
    expect(mocks.activity.create).not.toHaveBeenCalled()
  })

  it('traduce un CAS perdido en conflicto de estado', async () => {
    const { tx, mocks } = makeTx()
    mocks.workOrder.updateMany.mockResolvedValue({ count: 0 })
    await expect(
      transitionWorkOrderTx(tx, {
        workOrderId: 'wo1',
        expectedCurrentStatus: 'EN_CURSO',
        target: 'COMPLETADA',
        kind: 'forward',
        actorId: 'u1',
      })
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT' } satisfies Partial<WorkOrderTransitionError>)
  })

  it('rechaza un estado distinto del observado antes del lock', async () => {
    const { tx, mocks } = makeTx({ status: 'PRESUPUESTADA' })
    await expect(
      transitionWorkOrderTx(tx, {
        workOrderId: 'wo1',
        expectedCurrentStatus: 'EN_DIAGNOSTICO',
        target: 'PENDIENTE',
        kind: 'correction',
        actorId: 'u1',
        reason: 'Corrección concurrente',
      })
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT' } satisfies Partial<WorkOrderTransitionError>)
    expect(mocks.workOrder.updateMany).not.toHaveBeenCalled()
  })
})
