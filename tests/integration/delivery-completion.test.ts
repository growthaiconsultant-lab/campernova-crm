/**
 * Tests de integración con PostgreSQL REAL (PR3) — finalización atómica de entrega.
 *
 * Demuestran, sobre una base efímera migrada, que completar una entrega (entrega →
 * COMPLETADA, vehículo → VENDIDO, comprador → CERRADO, garantía + seguimientos DIA_7/DIA_30
 * + trazas) ocurre en una ÚNICA transacción: o se escribe todo, o no se escribe nada.
 *
 * La disponibilidad se decide con compare-and-swap dentro de la transacción, no con la
 * lectura previa. Dos finalizaciones concurrentes de la misma entrega producen exactamente
 * 1 éxito + 1 conflicto controlado, sin duplicar garantía, seguimientos ni trazas. Un fallo
 * en la garantía o en los seguimientos revierte TODO (incluidas las transiciones de estado).
 *
 * El solapamiento real se fuerza con el hook `beforeDeliveryWrite` (barrera de dos partes):
 * ambas transacciones se sincronizan justo antes del CAS de la entrega y compiten por la
 * misma fila. Los fallos deterministas se inyectan con `beforeWarrantyWrite`/`beforeFollowupsWrite`.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient, VehicleStatus, DeliveryStatus } from '@prisma/client'
import {
  completeDeliveryTx,
  DeliveryConflictError,
  type CompleteDeliveryHooks,
} from '@/lib/delivery-completion'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prisma: PrismaClient

// Transacciones interactivas con margen amplio para la barrera + bloqueo de fila en CI.
const TX_OPTS = { timeout: 20_000, maxWait: 15_000 }

/** Limpiezas registradas por cada seed; se ejecutan en orden inverso tras cada test. */
const cleanups: Array<() => Promise<void>> = []

type Seeded = {
  agentId: string
  sellerId: string
  vehicleId: string
  buyerId: string
  deliveryId: string
}

/**
 * Crea un escenario aislado: agente + vendedor + vehículo + comprador + entrega EN_CURSO.
 * `vehicleStatus` por defecto RESERVADO (estado típico previo a la entrega).
 */
async function seed(
  opts: { vehicleStatus?: VehicleStatus; deliveryStatus?: DeliveryStatus } = {}
): Promise<Seeded> {
  const s = uniqueSuffix()

  const agent = await prisma.user.create({
    data: { email: `agent_${s}@integ.test`, name: `Agent ${s}`, role: 'ENTREGAS' },
  })
  const seller = await prisma.sellerLead.create({
    data: { name: `Seller ${s}`, email: `seller_${s}@integ.test`, phone: '600000000' },
  })
  const vehicle = await prisma.vehicle.create({
    data: {
      sellerLeadId: seller.id,
      brand: 'Adria',
      model: 'Coral',
      year: 2020,
      km: 50_000,
      seats: 4,
      type: 'AUTOCARAVANA',
      status: opts.vehicleStatus ?? 'RESERVADO',
    },
  })
  const buyer = await prisma.buyerLead.create({
    data: { name: `Buyer ${s}`, email: `buyer_${s}@integ.test`, phone: '600000001' },
  })
  // I3C1B: toda Delivery está ligada a una Offer CONVERTIDA coherente (mismo vehículo + comprador).
  const offer = await prisma.offer.create({
    data: {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      amount: 25000,
      createdById: agent.id,
      status: 'CONVERTIDA',
    },
  })
  const delivery = await prisma.delivery.create({
    data: {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      offerId: offer.id,
      responsableId: agent.id,
      scheduledAt: new Date('2026-06-01T09:00:00Z'),
      status: opts.deliveryStatus ?? 'EN_CURSO',
      signedByName: 'Cliente',
      signedByDni: '12345678Z',
      signatureUrl: 'sig.png',
    },
  })

  cleanups.push(async () => {
    // Orden FK-safe: garantía → trazas → entrega → oferta → vehículo → leads → user.
    await prisma.warranty.deleteMany({ where: { deliveryId: delivery.id } })
    await prisma.activity.deleteMany({
      where: { OR: [{ sellerLeadId: seller.id }, { buyerLeadId: buyer.id }] },
    })
    await prisma.delivery.deleteMany({ where: { id: delivery.id } })
    await prisma.offer.deleteMany({ where: { vehicleId: vehicle.id } })
    await prisma.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prisma.buyerLead.deleteMany({ where: { id: buyer.id } })
    await prisma.sellerLead.deleteMany({ where: { id: seller.id } })
    await prisma.user.deleteMany({ where: { id: agent.id } })
  })

  return {
    agentId: agent.id,
    sellerId: seller.id,
    vehicleId: vehicle.id,
    buyerId: buyer.id,
    deliveryId: delivery.id,
  }
}

function completeParams(seeded: Seeded, now: Date) {
  return {
    deliveryId: seeded.deliveryId,
    vehicleId: seeded.vehicleId,
    buyerLeadId: seeded.buyerId,
    resolvedSellerLeadId: seeded.sellerId,
    actorId: seeded.agentId,
    now,
  }
}

function runCompletion(seeded: Seeded, now: Date, hooks?: CompleteDeliveryHooks) {
  return prisma.$transaction(
    (tx) => completeDeliveryTx(tx, completeParams(seeded, now), hooks),
    TX_OPTS
  )
}

/** Barrera de dos partes: ambas transacciones se esperan antes del CAS de la entrega. */
function twoPartyBarrier() {
  let arriveA!: () => void
  let arriveB!: () => void
  const aArrived = new Promise<void>((r) => (arriveA = r))
  const bArrived = new Promise<void>((r) => (arriveB = r))
  return {
    hookA: {
      beforeDeliveryWrite: async () => {
        arriveA()
        await bArrived
      },
    } satisfies CompleteDeliveryHooks,
    hookB: {
      beforeDeliveryWrite: async () => {
        arriveB()
        await aArrived
      },
    } satisfies CompleteDeliveryHooks,
  }
}

async function countActivities(seeded: Seeded) {
  return prisma.activity.count({
    where: { OR: [{ sellerLeadId: seeded.sellerId }, { buyerLeadId: seeded.buyerId }] },
  })
}

beforeAll(() => {
  prisma = createGuardedTestPrisma()
})

afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) {
    await clean()
  }
})

afterAll(async () => {
  await prisma?.$disconnect()
})

describe('integración · finalización atómica de entrega (camino feliz)', () => {
  it('completa entrega + vehículo + comprador + garantía + 2 seguimientos + 3 trazas', async () => {
    const seeded = await seed({ vehicleStatus: 'RESERVADO' })
    const now = new Date('2026-06-10T12:00:00Z')

    const result = await runCompletion(seeded, now)
    expect(result.warrantyId).toBeTruthy()

    const delivery = await prisma.delivery.findUnique({ where: { id: seeded.deliveryId } })
    expect(delivery?.status).toBe('COMPLETADA')
    expect(delivery?.completedAt).toEqual(now)

    const vehicle = await prisma.vehicle.findUnique({ where: { id: seeded.vehicleId } })
    expect(vehicle?.status).toBe('VENDIDO')
    expect(vehicle?.soldAt).toEqual(now)

    const buyer = await prisma.buyerLead.findUnique({ where: { id: seeded.buyerId } })
    expect(buyer?.status).toBe('CERRADO')

    // Garantía exactamente una, vinculada y con fechas correctas (+12 meses).
    const warranties = await prisma.warranty.findMany({ where: { deliveryId: seeded.deliveryId } })
    expect(warranties).toHaveLength(1)
    expect(warranties[0].vehicleId).toBe(seeded.vehicleId)
    expect(warranties[0].buyerLeadId).toBe(seeded.buyerId)
    expect(warranties[0].startDate).toEqual(now)
    const expectedEnd = new Date(now)
    expectedEnd.setFullYear(expectedEnd.getFullYear() + 1)
    expect(warranties[0].endDate).toEqual(expectedEnd)

    // Seguimientos: exactamente DIA_7 y DIA_30.
    const followups = await prisma.postventaFollowup.findMany({
      where: { warrantyId: warranties[0].id },
      orderBy: { scheduledFor: 'asc' },
    })
    expect(followups.map((f) => f.type)).toEqual(['DIA_7', 'DIA_30'])

    // Trazas: exactamente 3 (CAMBIO_ESTADO + ENTREGA_COMPLETADA + GARANTIA_ACTIVADA).
    expect(await countActivities(seeded)).toBe(3)
    expect(
      await prisma.activity.count({
        where: { type: 'ENTREGA_COMPLETADA', buyerLeadId: seeded.buyerId },
      })
    ).toBe(1)
  })
})

describe('integración · dos finalizaciones concurrentes de la misma entrega', () => {
  it('exactamente 1 éxito + 1 conflicto "delivery"; una sola garantía, seguimientos y trazas', async () => {
    const seeded = await seed({ vehicleStatus: 'RESERVADO' })
    const now = new Date('2026-06-10T12:00:00Z')
    const { hookA, hookB } = twoPartyBarrier()

    const settled = await Promise.allSettled([
      runCompletion(seeded, now, hookA),
      runCompletion(seeded, now, hookB),
    ])
    const fulfilled = settled.filter((r) => r.status === 'fulfilled')
    const rejected = settled.filter((r) => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    const reason = (rejected[0] as PromiseRejectedResult).reason
    expect(reason).toBeInstanceOf(DeliveryConflictError)
    expect((reason as DeliveryConflictError).reason).toBe('delivery')

    // Una sola finalización y ningún duplicado.
    const delivery = await prisma.delivery.findUnique({ where: { id: seeded.deliveryId } })
    expect(delivery?.status).toBe('COMPLETADA')
    const vehicle = await prisma.vehicle.findUnique({ where: { id: seeded.vehicleId } })
    expect(vehicle?.status).toBe('VENDIDO')

    const warranties = await prisma.warranty.findMany({ where: { deliveryId: seeded.deliveryId } })
    expect(warranties).toHaveLength(1)
    const followups = await prisma.postventaFollowup.findMany({
      where: { warrantyId: warranties[0].id },
    })
    expect(followups).toHaveLength(2)
    // Sin trazas duplicadas: exactamente 3 (las del único intento exitoso).
    expect(await countActivities(seeded)).toBe(3)
  })
})

describe('integración · rollback total', () => {
  it('fallo en la garantía → revierte todo: entrega EN_CURSO, vehículo RESERVADO, sin garantía/seguimientos/trazas', async () => {
    const seeded = await seed({ vehicleStatus: 'RESERVADO' })
    const now = new Date('2026-06-10T12:00:00Z')

    await expect(
      runCompletion(seeded, now, {
        beforeWarrantyWrite: async () => {
          throw new Error('fallo inyectado antes de la garantía')
        },
      })
    ).rejects.toThrow('fallo inyectado antes de la garantía')

    const delivery = await prisma.delivery.findUnique({ where: { id: seeded.deliveryId } })
    expect(delivery?.status).toBe('EN_CURSO')
    expect(delivery?.completedAt).toBeNull()
    const vehicle = await prisma.vehicle.findUnique({ where: { id: seeded.vehicleId } })
    expect(vehicle?.status).toBe('RESERVADO')
    expect(vehicle?.soldAt).toBeNull()
    expect(await prisma.warranty.count({ where: { deliveryId: seeded.deliveryId } })).toBe(0)
    expect(await countActivities(seeded)).toBe(0)
    const buyer = await prisma.buyerLead.findUnique({ where: { id: seeded.buyerId } })
    expect(buyer?.status).not.toBe('CERRADO')
  })

  it('fallo en los seguimientos → revierte todo, incluida la garantía ya insertada', async () => {
    const seeded = await seed({ vehicleStatus: 'RESERVADO' })
    const now = new Date('2026-06-10T12:00:00Z')

    await expect(
      runCompletion(seeded, now, {
        beforeFollowupsWrite: async () => {
          throw new Error('fallo inyectado antes de los seguimientos')
        },
      })
    ).rejects.toThrow('fallo inyectado antes de los seguimientos')

    const delivery = await prisma.delivery.findUnique({ where: { id: seeded.deliveryId } })
    expect(delivery?.status).toBe('EN_CURSO')
    const vehicle = await prisma.vehicle.findUnique({ where: { id: seeded.vehicleId } })
    expect(vehicle?.status).toBe('RESERVADO')
    // La garantía se insertó dentro de la tx pero el rollback la elimina por completo.
    expect(await prisma.warranty.count({ where: { deliveryId: seeded.deliveryId } })).toBe(0)
    expect(
      await prisma.postventaFollowup.count({
        where: { warranty: { deliveryId: seeded.deliveryId } },
      })
    ).toBe(0)
    expect(await countActivities(seeded)).toBe(0)
  })
})

describe('integración · estado del vehículo incompatible', () => {
  it('vehículo no entregable (TASADO) → conflicto "vehicle" y entrega sin completar', async () => {
    const seeded = await seed({ vehicleStatus: 'TASADO' })
    const now = new Date('2026-06-10T12:00:00Z')

    const err = await runCompletion(seeded, now).catch((e) => e)
    expect(err).toBeInstanceOf(DeliveryConflictError)
    expect((err as DeliveryConflictError).reason).toBe('vehicle')

    const delivery = await prisma.delivery.findUnique({ where: { id: seeded.deliveryId } })
    expect(delivery?.status).toBe('EN_CURSO')
    expect(delivery?.completedAt).toBeNull()
    const vehicle = await prisma.vehicle.findUnique({ where: { id: seeded.vehicleId } })
    expect(vehicle?.status).toBe('TASADO')
    expect(await prisma.warranty.count({ where: { deliveryId: seeded.deliveryId } })).toBe(0)
    expect(await countActivities(seeded)).toBe(0)
  })
})
