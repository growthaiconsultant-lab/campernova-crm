import { describe, it, expect, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import {
  completeDeliveryTx,
  DeliveryConflictError,
  DELIVERY_CONFLICT_MESSAGES,
  DELIVERABLE_VEHICLE_STATUSES,
  type CompleteDeliveryParams,
} from './delivery-completion'

// Mock mínimo de la TransactionClient: incluye lo que usa completeDeliveryTx Y lo que usa
// createWarrantyForDelivery (delivery.findUnique / warranty.create / postventaFollowup.createMany).
type MockTx = {
  delivery: { updateMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> }
  vehicle: { updateMany: ReturnType<typeof vi.fn> }
  match: { updateMany: ReturnType<typeof vi.fn> }
  buyerLead: { update: ReturnType<typeof vi.fn> }
  warranty: { create: ReturnType<typeof vi.fn> }
  postventaFollowup: { createMany: ReturnType<typeof vi.fn> }
  activity: { create: ReturnType<typeof vi.fn> }
}

const COMPLETED_AT = new Date('2026-06-01T10:00:00Z')

function makeTx(opts: { deliveryCount?: number; vehicleCount?: number } = {}): MockTx {
  return {
    delivery: {
      updateMany: vi.fn().mockResolvedValue({ count: opts.deliveryCount ?? 1 }),
      findUnique: vi
        .fn()
        .mockResolvedValue({
          vehicleId: 'veh-1',
          buyerLeadId: 'buyer-1',
          completedAt: COMPLETED_AT,
        }),
    },
    vehicle: { updateMany: vi.fn().mockResolvedValue({ count: opts.vehicleCount ?? 1 }) },
    match: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    buyerLead: { update: vi.fn().mockResolvedValue({}) },
    warranty: { create: vi.fn().mockResolvedValue({ id: 'war-1' }) },
    postventaFollowup: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    activity: { create: vi.fn().mockResolvedValue({}) },
  }
}

const asTx = (tx: MockTx) => tx as unknown as Prisma.TransactionClient

const baseParams: CompleteDeliveryParams = {
  deliveryId: 'del-1',
  vehicleId: 'veh-1',
  buyerLeadId: 'buyer-1',
  sellerLeadId: 'seller-1',
  actorId: 'user-1',
  now: COMPLETED_AT,
}

describe('completeDeliveryTx · camino feliz', () => {
  it('completa entrega + vehículo + comprador + garantía + seguimientos + 3 trazas de forma atómica', async () => {
    const tx = makeTx()
    const res = await completeDeliveryTx(asTx(tx), baseParams)

    expect(res).toEqual({ warrantyId: 'war-1' })

    // CAS de la entrega: EN_CURSO → COMPLETADA con completedAt.
    expect(tx.delivery.updateMany).toHaveBeenCalledWith({
      where: { id: 'del-1', status: 'EN_CURSO' },
      data: { status: 'COMPLETADA', completedAt: COMPLETED_AT },
    })
    // CAS del vehículo: solo desde estados entregables → VENDIDO.
    expect(tx.vehicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'veh-1', status: { in: DELIVERABLE_VEHICLE_STATUSES } },
      data: { status: 'VENDIDO', soldAt: COMPLETED_AT },
    })
    // Match OFERTA → CERRADO y comprador → CERRADO.
    expect(tx.match.updateMany).toHaveBeenCalledWith({
      where: { vehicleId: 'veh-1', buyerLeadId: 'buyer-1', status: 'OFERTA' },
      data: { status: 'CERRADO' },
    })
    expect(tx.buyerLead.update).toHaveBeenCalledWith({
      where: { id: 'buyer-1' },
      data: { status: 'CERRADO' },
    })
    // Garantía + 2 seguimientos (creados por createWarrantyForDelivery con el mismo tx).
    expect(tx.warranty.create).toHaveBeenCalledOnce()
    expect(tx.postventaFollowup.createMany).toHaveBeenCalledOnce()
    // 3 trazas: CAMBIO_ESTADO + ENTREGA_COMPLETADA + GARANTIA_ACTIVADA.
    expect(tx.activity.create).toHaveBeenCalledTimes(3)
    const types = tx.activity.create.mock.calls.map((c) => c[0].data.type)
    expect(types).toEqual(['CAMBIO_ESTADO', 'ENTREGA_COMPLETADA', 'GARANTIA_ACTIVADA'])
  })

  it('crea las trazas aunque el vehículo no tenga vendedor (sellerLeadId null)', async () => {
    const tx = makeTx()
    await completeDeliveryTx(asTx(tx), { ...baseParams, sellerLeadId: null })
    expect(tx.activity.create).toHaveBeenCalledTimes(3)
  })
})

describe('completeDeliveryTx · conflictos (compare-and-swap)', () => {
  it('conflicto "delivery": si la entrega ya no está EN_CURSO no toca vehículo, garantía ni trazas', async () => {
    const tx = makeTx({ deliveryCount: 0 })
    const err = await completeDeliveryTx(asTx(tx), baseParams).catch((e) => e)
    expect(err).toBeInstanceOf(DeliveryConflictError)
    expect((err as DeliveryConflictError).reason).toBe('delivery')
    expect((err as DeliveryConflictError).message).toBe(DELIVERY_CONFLICT_MESSAGES.delivery)
    expect(tx.vehicle.updateMany).not.toHaveBeenCalled()
    expect(tx.warranty.create).not.toHaveBeenCalled()
    expect(tx.postventaFollowup.createMany).not.toHaveBeenCalled()
    expect(tx.activity.create).not.toHaveBeenCalled()
  })

  it('conflicto "vehicle": si el vehículo no está en un estado entregable, aborta sin garantía ni trazas', async () => {
    const tx = makeTx({ vehicleCount: 0 })
    const err = await completeDeliveryTx(asTx(tx), baseParams).catch((e) => e)
    expect(err).toBeInstanceOf(DeliveryConflictError)
    expect((err as DeliveryConflictError).reason).toBe('vehicle')
    // La entrega intentó su CAS, pero el conflicto del vehículo aborta antes de garantía/trazas
    // (en producción, el throw revierte también el CAS de la entrega).
    expect(tx.delivery.updateMany).toHaveBeenCalledOnce()
    expect(tx.warranty.create).not.toHaveBeenCalled()
    expect(tx.activity.create).not.toHaveBeenCalled()
  })
})

describe('completeDeliveryTx · errores técnicos se propagan (no se ocultan como conflicto)', () => {
  it('un fallo al crear la garantía se propaga tal cual y no genera trazas', async () => {
    const tx = makeTx()
    tx.warranty.create.mockRejectedValue(new Error('warranty boom'))
    const err = await completeDeliveryTx(asTx(tx), baseParams).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(DeliveryConflictError)
    expect((err as Error).message).toBe('warranty boom')
    expect(tx.activity.create).not.toHaveBeenCalled()
  })

  it('un fallo al crear los seguimientos se propaga y no genera trazas', async () => {
    const tx = makeTx()
    tx.postventaFollowup.createMany.mockRejectedValue(new Error('followups boom'))
    const err = await completeDeliveryTx(asTx(tx), baseParams).catch((e) => e)
    expect(err).not.toBeInstanceOf(DeliveryConflictError)
    expect((err as Error).message).toBe('followups boom')
    // La garantía se intentó, pero las trazas van después de los seguimientos → no se crean.
    expect(tx.warranty.create).toHaveBeenCalledOnce()
    expect(tx.activity.create).not.toHaveBeenCalled()
  })
})

describe('completeDeliveryTx · hooks de test (seams deterministas)', () => {
  it('respeta el orden: beforeDeliveryWrite → CAS entrega → CAS vehículo → beforeWarrantyWrite → garantía → beforeFollowupsWrite → seguimientos', async () => {
    const order: string[] = []
    const tx = makeTx()
    tx.delivery.updateMany.mockImplementation(async () => {
      order.push('delivery-cas')
      return { count: 1 }
    })
    tx.vehicle.updateMany.mockImplementation(async () => {
      order.push('vehicle-cas')
      return { count: 1 }
    })
    tx.warranty.create.mockImplementation(async () => {
      order.push('warranty')
      return { id: 'war-1' }
    })
    tx.postventaFollowup.createMany.mockImplementation(async () => {
      order.push('followups')
      return { count: 2 }
    })

    await completeDeliveryTx(asTx(tx), baseParams, {
      beforeDeliveryWrite: async () => {
        order.push('hook:beforeDelivery')
      },
      beforeWarrantyWrite: async () => {
        order.push('hook:beforeWarranty')
      },
      beforeFollowupsWrite: async () => {
        order.push('hook:beforeFollowups')
      },
    })

    expect(order).toEqual([
      'hook:beforeDelivery',
      'delivery-cas',
      'vehicle-cas',
      'hook:beforeWarranty',
      'warranty',
      'hook:beforeFollowups',
      'followups',
    ])
  })

  it('un throw en beforeWarrantyWrite se propaga y no crea garantía ni trazas', async () => {
    const tx = makeTx()
    const err = await completeDeliveryTx(asTx(tx), baseParams, {
      beforeWarrantyWrite: async () => {
        throw new Error('inject warranty failure')
      },
    }).catch((e) => e)
    expect(err).not.toBeInstanceOf(DeliveryConflictError)
    expect((err as Error).message).toBe('inject warranty failure')
    expect(tx.warranty.create).not.toHaveBeenCalled()
    expect(tx.activity.create).not.toHaveBeenCalled()
  })
})

describe('constantes de dominio', () => {
  it('los estados entregables son PUBLICADO y RESERVADO', () => {
    expect(DELIVERABLE_VEHICLE_STATUSES).toEqual(['PUBLICADO', 'RESERVADO'])
  })

  it('DeliveryConflictError expone reason y un mensaje de negocio claro', () => {
    const e = new DeliveryConflictError('delivery')
    expect(e.name).toBe('DeliveryConflictError')
    expect(e.reason).toBe('delivery')
    expect(e.message).toBe(DELIVERY_CONFLICT_MESSAGES.delivery)
  })
})
