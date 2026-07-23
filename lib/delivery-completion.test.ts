import { describe, it, expect, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import {
  completeDeliveryTx,
  DeliveryConflictError,
  DeliveryCompletionError,
  isDeliveryCompletionError,
  DELIVERABLE_VEHICLE_STATUSES,
  type CompleteDeliveryParams,
} from './delivery-completion'

/* eslint-disable @typescript-eslint/no-explicit-any */
const COMPLETED_AT = new Date('2026-06-01T10:00:00Z')

type TxOpts = {
  status?: string
  checklist?: Array<{ result: string }>
  signed?: boolean
  vehicleStatus?: string
  vehicleSeller?: string | null
  sellerExists?: boolean
  buyerExists?: boolean
  offer?: { vehicleId: string; buyerLeadId: string } | null
  deliveryCount?: number
  vehicleCount?: number
}

function makeTx(o: TxOpts = {}) {
  const signed = o.signed ?? true
  const delivery = {
    status: o.status ?? 'EN_CURSO',
    vehicleId: 'veh-1',
    buyerLeadId: 'buyer-1',
    offerId: 'offer-1',
    signedByName: signed ? 'Cliente' : null,
    signedByDni: signed ? '12345678Z' : null,
    signatureUrl: signed ? 'sig.png' : null,
    checklist: o.checklist ?? [],
    // usado por createWarrantyForDelivery
    completedAt: COMPLETED_AT,
  }
  return {
    delivery: {
      findUnique: vi.fn().mockResolvedValue(delivery),
      updateMany: vi.fn().mockResolvedValue({ count: o.deliveryCount ?? 1 }),
    },
    vehicle: {
      findUnique: vi.fn().mockResolvedValue({
        status: o.vehicleStatus ?? 'RESERVADO',
        sellerLeadId: o.vehicleSeller === undefined ? 'seller-1' : o.vehicleSeller,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: o.vehicleCount ?? 1 }),
    },
    sellerLead: {
      findUnique: vi.fn().mockResolvedValue((o.sellerExists ?? true) ? { id: 'seller-1' } : null),
    },
    buyerLead: {
      findUnique: vi.fn().mockResolvedValue((o.buyerExists ?? true) ? { id: 'buyer-1' } : null),
      update: vi.fn().mockResolvedValue({}),
    },
    offer: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          o.offer === undefined ? { vehicleId: 'veh-1', buyerLeadId: 'buyer-1' } : o.offer
        ),
    },
    match: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    warranty: { create: vi.fn().mockResolvedValue({ id: 'war-1' }) },
    postventaFollowup: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    activity: { create: vi.fn().mockResolvedValue({}) },
  }
}
const asTx = (tx: any) => tx as unknown as Prisma.TransactionClient

const baseParams: CompleteDeliveryParams = {
  deliveryId: 'del-1',
  vehicleId: 'veh-1',
  buyerLeadId: 'buyer-1',
  resolvedSellerLeadId: 'seller-1',
  actorId: 'user-1',
  now: COMPLETED_AT,
}

async function code(p: Promise<unknown>): Promise<string | null> {
  try {
    await p
    return null
  } catch (e) {
    return isDeliveryCompletionError(e)
      ? e.code
      : e instanceof DeliveryConflictError
        ? e.reason
        : 'OTHER'
  }
}

describe('completeDeliveryTx · camino feliz', () => {
  it('completa entrega + vehículo + comprador + garantía + seguimientos + 3 trazas de forma atómica', async () => {
    const tx = makeTx()
    const res = await completeDeliveryTx(asTx(tx), baseParams)
    expect(res).toEqual({ warrantyId: 'war-1' })
    expect(tx.delivery.updateMany).toHaveBeenCalledWith({
      where: { id: 'del-1', status: 'EN_CURSO' },
      data: { status: 'COMPLETADA', completedAt: COMPLETED_AT },
    })
    expect(tx.vehicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'veh-1', status: { in: DELIVERABLE_VEHICLE_STATUSES } },
      data: { status: 'VENDIDO', soldAt: COMPLETED_AT },
    })
    expect(tx.match.updateMany).toHaveBeenCalledWith({
      where: { vehicleId: 'veh-1', buyerLeadId: 'buyer-1', status: 'OFERTA' },
      data: { status: 'CERRADO' },
    })
    expect(tx.buyerLead.update).toHaveBeenCalledWith({
      where: { id: 'buyer-1' },
      data: { status: 'CERRADO' },
    })
    expect(tx.warranty.create).toHaveBeenCalledOnce()
    expect(tx.postventaFollowup.createMany).toHaveBeenCalledOnce()
    const types = tx.activity.create.mock.calls.map((c: any) => c[0].data.type)
    expect(types).toEqual(['CAMBIO_ESTADO', 'ENTREGA_COMPLETADA', 'GARANTIA_ACTIVADA'])
  })

  it('completa aunque el vehículo no tenga vendedor (sellerLeadId null)', async () => {
    const tx = makeTx({ vehicleSeller: null })
    await completeDeliveryTx(asTx(tx), { ...baseParams, resolvedSellerLeadId: null })
    expect(tx.activity.create).toHaveBeenCalledTimes(3)
    // sin vendedor no se relee sellerLead
    expect(tx.sellerLead.findUnique).not.toHaveBeenCalled()
  })
})

describe('completeDeliveryTx · validación bajo lock (pre-CAS)', () => {
  it('DELIVERY_NOT_FOUND si la entrega no existe', async () => {
    const tx = makeTx()
    tx.delivery.findUnique.mockResolvedValueOnce(null)
    expect(await code(completeDeliveryTx(asTx(tx), baseParams))).toBe('DELIVERY_NOT_FOUND')
    expect(tx.delivery.updateMany).not.toHaveBeenCalled()
  })

  it('DELIVERY_ROOT_CHANGED si el vendedor releído no coincide', async () => {
    const tx = makeTx({ vehicleSeller: 'otro' })
    expect(await code(completeDeliveryTx(asTx(tx), baseParams))).toBe('DELIVERY_ROOT_CHANGED')
    expect(tx.delivery.updateMany).not.toHaveBeenCalled()
  })

  it('OFFER_MISMATCH si la oferta no corresponde al par', async () => {
    const tx = makeTx({ offer: { vehicleId: 'veh-X', buyerLeadId: 'buyer-1' } })
    expect(await code(completeDeliveryTx(asTx(tx), baseParams))).toBe('OFFER_MISMATCH')
  })

  it('DELIVERY_ALREADY_COMPLETED si ya está COMPLETADA', async () => {
    expect(await code(completeDeliveryTx(asTx(makeTx({ status: 'COMPLETADA' })), baseParams))).toBe(
      'DELIVERY_ALREADY_COMPLETED'
    )
  })

  it('DELIVERY_ALREADY_CANCELLED si está CANCELADA', async () => {
    expect(await code(completeDeliveryTx(asTx(makeTx({ status: 'CANCELADA' })), baseParams))).toBe(
      'DELIVERY_ALREADY_CANCELLED'
    )
  })

  it('DELIVERY_STATUS_CHANGED si el estado no es EN_CURSO (p. ej. PROGRAMADA)', async () => {
    expect(await code(completeDeliveryTx(asTx(makeTx({ status: 'PROGRAMADA' })), baseParams))).toBe(
      'DELIVERY_STATUS_CHANGED'
    )
  })

  it('CHECKLIST_INCOMPLETE si hay un ítem PENDIENTE (validado bajo lock)', async () => {
    const tx = makeTx({ checklist: [{ result: 'OK' }, { result: 'PENDIENTE' }] })
    expect(await code(completeDeliveryTx(asTx(tx), baseParams))).toBe('CHECKLIST_INCOMPLETE')
    expect(tx.delivery.updateMany).not.toHaveBeenCalled()
  })

  it('SIGNATURE_REQUIRED si falta la firma', async () => {
    const tx = makeTx({ signed: false })
    expect(await code(completeDeliveryTx(asTx(tx), baseParams))).toBe('SIGNATURE_REQUIRED')
  })

  it('la clasificación terminal precede al checklist/firma (COMPLETADA sin firma → ALREADY_COMPLETED)', async () => {
    const tx = makeTx({ status: 'COMPLETADA', signed: false, checklist: [{ result: 'PENDIENTE' }] })
    expect(await code(completeDeliveryTx(asTx(tx), baseParams))).toBe('DELIVERY_ALREADY_COMPLETED')
  })
})

describe('completeDeliveryTx · CAS y conflicto', () => {
  it("conflicto 'delivery' si el CAS de la entrega afecta 0 filas", async () => {
    const tx = makeTx({ deliveryCount: 0 })
    expect(await code(completeDeliveryTx(asTx(tx), baseParams))).toBe('delivery')
    expect(tx.vehicle.updateMany).not.toHaveBeenCalled()
  })

  it("conflicto 'vehicle' si el CAS del vehículo afecta 0 filas", async () => {
    const tx = makeTx({ vehicleCount: 0 })
    expect(await code(completeDeliveryTx(asTx(tx), baseParams))).toBe('vehicle')
    expect(tx.warranty.create).not.toHaveBeenCalled()
  })

  it('DELIVERABLE_VEHICLE_STATUSES son PUBLICADO y RESERVADO', () => {
    expect(DELIVERABLE_VEHICLE_STATUSES).toEqual(['PUBLICADO', 'RESERVADO'])
  })

  it('DeliveryCompletionError expone code + mensaje sin PII', () => {
    const e = new DeliveryCompletionError('CHECKLIST_INCOMPLETE')
    expect(e.code).toBe('CHECKLIST_INCOMPLETE')
    expect(e.message).toMatch(/checklist/i)
    expect(isDeliveryCompletionError(e)).toBe(true)
  })
})
