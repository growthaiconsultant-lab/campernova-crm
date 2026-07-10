import { describe, it, expect, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import {
  applyOfferStatusChangeTx,
  OfferConflictError,
  OFFER_CONFLICT_MESSAGES,
  shouldReserveVehicle,
  shouldReleaseVehicle,
  type ApplyOfferStatusParams,
} from './offers-reservation'

// Mock mínimo de la TransactionClient: solo los métodos que usa el servicio.
type MockTx = {
  offer: { updateMany: ReturnType<typeof vi.fn> }
  vehicle: { updateMany: ReturnType<typeof vi.fn> }
  activity: { create: ReturnType<typeof vi.fn> }
}

function makeTx(opts: { offerCount?: number; vehicleCount?: number } = {}): MockTx {
  return {
    offer: { updateMany: vi.fn().mockResolvedValue({ count: opts.offerCount ?? 1 }) },
    vehicle: { updateMany: vi.fn().mockResolvedValue({ count: opts.vehicleCount ?? 1 }) },
    activity: { create: vi.fn().mockResolvedValue({}) },
  }
}

const asTx = (tx: MockTx) => tx as unknown as Prisma.TransactionClient

const baseAccept: ApplyOfferStatusParams = {
  offerId: 'offer-1',
  fromStatus: 'PROPUESTA',
  toStatus: 'ACEPTADA',
  offerData: { depositAmount: 1000, reservedUntil: null, amount: 25000 },
  vehicleId: 'veh-1',
  reserve: true,
  release: false,
  activityContent: 'Oferta aceptada — Adria Coral',
  actorId: 'user-1',
  buyerLeadId: 'buyer-1',
  sellerLeadId: 'seller-1',
}

describe('applyOfferStatusChangeTx · aceptación (reserva atómica)', () => {
  it('reserva el vehículo con compare-and-swap y deja traza en ambos lados', async () => {
    const tx = makeTx()
    const res = await applyOfferStatusChangeTx(asTx(tx), baseAccept)

    expect(res).toEqual({ reserved: true, released: false })

    // CAS de la oferta desde su estado esperado (no una lectura previa).
    expect(tx.offer.updateMany).toHaveBeenCalledWith({
      where: { id: 'offer-1', status: 'PROPUESTA' },
      data: expect.objectContaining({ status: 'ACEPTADA', decidedAt: expect.any(Date) }),
    })
    // CAS del vehículo: solo reserva si sigue PUBLICADO.
    expect(tx.vehicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'veh-1', status: 'PUBLICADO' },
      data: { status: 'RESERVADO' },
    })
    // Traza en comprador + vendedor.
    expect(tx.activity.create).toHaveBeenCalledTimes(2)
  })

  it('conflicto "offer": si la oferta ya cambió (count 0) no toca el vehículo ni crea trazas', async () => {
    const tx = makeTx({ offerCount: 0 })
    const err = await applyOfferStatusChangeTx(asTx(tx), baseAccept).catch((e) => e)
    expect(err).toBeInstanceOf(OfferConflictError)
    expect((err as OfferConflictError).reason).toBe('offer')
    expect((err as OfferConflictError).message).toBe(OFFER_CONFLICT_MESSAGES.offer)
    expect(tx.vehicle.updateMany).not.toHaveBeenCalled()
    expect(tx.activity.create).not.toHaveBeenCalled()
  })

  it('conflicto "vehicle": si el vehículo ya no está PUBLICADO (count 0) revierte, sin traza', async () => {
    const tx = makeTx({ vehicleCount: 0 })
    const err = await applyOfferStatusChangeTx(asTx(tx), baseAccept).catch((e) => e)
    expect(err).toBeInstanceOf(OfferConflictError)
    expect((err as OfferConflictError).reason).toBe('vehicle')
    // La oferta intentó su CAS, pero el conflicto del vehículo aborta antes de las trazas
    // (en producción, el throw revierte también el CAS de la oferta).
    expect(tx.offer.updateMany).toHaveBeenCalledOnce()
    expect(tx.activity.create).not.toHaveBeenCalled()
  })

  it('espera al hook beforeVehicleWrite antes de escribir el vehículo (orden determinista)', async () => {
    const order: string[] = []
    const tx = makeTx()
    tx.vehicle.updateMany.mockImplementation(async () => {
      order.push('vehicle')
      return { count: 1 }
    })
    await applyOfferStatusChangeTx(asTx(tx), baseAccept, {
      beforeVehicleWrite: async () => {
        order.push('hook')
      },
    })
    expect(order).toEqual(['hook', 'vehicle'])
  })

  it('crea una sola traza si el vehículo no tiene vendedor asociado', async () => {
    const tx = makeTx()
    await applyOfferStatusChangeTx(asTx(tx), { ...baseAccept, sellerLeadId: null })
    expect(tx.activity.create).toHaveBeenCalledOnce()
  })
})

describe('applyOfferStatusChangeTx · liberación de reserva', () => {
  const baseRelease: ApplyOfferStatusParams = {
    ...baseAccept,
    fromStatus: 'ACEPTADA',
    toStatus: 'CANCELADA',
    offerData: {},
    reserve: false,
    release: true,
    activityContent: 'Oferta cancelada — Adria Coral',
  }

  it('libera el vehículo (RESERVADO → PUBLICADO) con escritura condicional', async () => {
    const tx = makeTx()
    const res = await applyOfferStatusChangeTx(asTx(tx), baseRelease)
    expect(res).toEqual({ reserved: false, released: true })
    expect(tx.vehicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'veh-1', status: 'RESERVADO' },
      data: { status: 'PUBLICADO' },
    })
  })

  it('liberar es idempotente: si el vehículo ya no estaba RESERVADO (count 0) no es conflicto', async () => {
    const tx = makeTx({ vehicleCount: 0 })
    const res = await applyOfferStatusChangeTx(asTx(tx), baseRelease)
    expect(res).toEqual({ reserved: false, released: false })
  })
})

describe('applyOfferStatusChangeTx · transición sin efecto de stock', () => {
  it('no toca el vehículo al rechazar una propuesta', async () => {
    const tx = makeTx()
    const res = await applyOfferStatusChangeTx(asTx(tx), {
      ...baseAccept,
      toStatus: 'RECHAZADA',
      offerData: { rejectionReason: 'PRECIO' },
      reserve: false,
      release: false,
      activityContent: 'Oferta rechazada',
    })
    expect(res).toEqual({ reserved: false, released: false })
    expect(tx.vehicle.updateMany).not.toHaveBeenCalled()
    expect(tx.activity.create).toHaveBeenCalledTimes(2)
  })
})

describe('shouldReserveVehicle / shouldReleaseVehicle (guards puros)', () => {
  it('solo ACEPTADA reserva', () => {
    expect(shouldReserveVehicle('ACEPTADA')).toBe(true)
    for (const s of [
      'PROPUESTA',
      'CONTRAOFERTA',
      'CONVERTIDA',
      'RECHAZADA',
      'EXPIRADA',
      'RETIRADA',
      'CANCELADA',
    ] as const) {
      expect(shouldReserveVehicle(s)).toBe(false)
    }
  })

  it('libera solo desde una reserva viva (fromStatus ACEPTADA) hacia un estado liberador', () => {
    expect(shouldReleaseVehicle('ACEPTADA', 'CANCELADA')).toBe(true)
    expect(shouldReleaseVehicle('ACEPTADA', 'RETIRADA')).toBe(true)
    expect(shouldReleaseVehicle('ACEPTADA', 'EXPIRADA')).toBe(true)
    // Convertir NO libera: la reserva sigue ocupando el vehículo hasta la venta real.
    expect(shouldReleaseVehicle('ACEPTADA', 'CONVERTIDA')).toBe(false)
    // No libera si la oferta no era una reserva (nunca fue ACEPTADA).
    expect(shouldReleaseVehicle('PROPUESTA', 'RETIRADA')).toBe(false)
    expect(shouldReleaseVehicle('CONTRAOFERTA', 'EXPIRADA')).toBe(false)
  })
})
