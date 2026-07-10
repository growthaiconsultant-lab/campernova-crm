/**
 * Tests de integración con PostgreSQL REAL (PR2) — reserva atómica de ofertas.
 *
 * Demuestran, sobre una base efímera migrada, que la aceptación de una oferta y la
 * transición del vehículo a RESERVADO son ATÓMICAS mediante compare-and-swap dentro
 * de una única transacción, y que dos aceptaciones concurrentes sobre el mismo vehículo
 * producen exactamente: 1 éxito + 1 conflicto controlado + 1 vehículo reservado +
 * 1 oferta aceptada, sin estado parcial ni efectos duplicados.
 *
 * El solapamiento real se fuerza con el hook `beforeVehicleWrite` (barrera de dos
 * partes): ambas transacciones completan el CAS de la oferta y quedan detenidas justo
 * antes del CAS del vehículo, garantizando que compiten por la misma fila.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient, VehicleStatus, OfferStatus } from '@prisma/client'
import { applyOfferStatusChangeTx, OfferConflictError } from '@/lib/offers-reservation'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prisma: PrismaClient

// Transacciones interactivas con margen amplio para la barrera + bloqueo de fila en CI.
const TX_OPTS = { timeout: 20_000, maxWait: 15_000 }

/** Limpiezas registradas por cada seed; se ejecutan en orden inverso tras cada test. */
const cleanups: Array<() => Promise<void>> = []

type SeededOffer = { id: string; buyerId: string }

/**
 * Crea un escenario aislado: 1 agente + 1 vendedor + 1 vehículo + N compradores/ofertas.
 * Cada oferta tiene su propio comprador (las carreras del mismo vehículo usan ofertas
 * distintas). Registra su limpieza en `cleanups`.
 */
async function seed(opts: {
  vehicleStatus?: VehicleStatus
  offers: Array<{ status?: OfferStatus; amount?: number }>
}): Promise<{
  agentId: string
  sellerId: string
  vehicleId: string
  offers: SeededOffer[]
}> {
  const s = uniqueSuffix()

  const agent = await prisma.user.create({
    data: { email: `agent_${s}@integ.test`, name: `Agent ${s}`, role: 'AGENTE' },
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
      status: opts.vehicleStatus ?? 'PUBLICADO',
    },
  })

  const offers: SeededOffer[] = []
  for (let i = 0; i < opts.offers.length; i++) {
    const o = opts.offers[i]
    const buyer = await prisma.buyerLead.create({
      data: { name: `Buyer ${s}-${i}`, email: `buyer_${s}_${i}@integ.test`, phone: '600000001' },
    })
    const offer = await prisma.offer.create({
      data: {
        vehicleId: vehicle.id,
        buyerLeadId: buyer.id,
        amount: o.amount ?? 25_000,
        status: o.status ?? 'PROPUESTA',
        createdById: agent.id,
      },
    })
    offers.push({ id: offer.id, buyerId: buyer.id })
  }

  const buyerIds = offers.map((x) => x.buyerId)
  cleanups.push(async () => {
    await prisma.offer.deleteMany({ where: { vehicleId: vehicle.id } })
    await prisma.activity.deleteMany({
      where: { OR: [{ sellerLeadId: seller.id }, { buyerLeadId: { in: buyerIds } }] },
    })
    await prisma.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prisma.buyerLead.deleteMany({ where: { id: { in: buyerIds } } })
    await prisma.sellerLead.deleteMany({ where: { id: seller.id } })
    await prisma.user.deleteMany({ where: { id: agent.id } })
  })

  return { agentId: agent.id, sellerId: seller.id, vehicleId: vehicle.id, offers }
}

/** Parámetros de una aceptación (PROPUESTA → ACEPTADA con reserva del vehículo). */
function acceptParams(args: {
  offerId: string
  vehicleId: string
  buyerLeadId: string
  sellerLeadId: string | null
  agentId: string
}) {
  return {
    offerId: args.offerId,
    fromStatus: 'PROPUESTA' as OfferStatus,
    toStatus: 'ACEPTADA' as OfferStatus,
    offerData: { depositAmount: 1000, reservedUntil: null, amount: 25_000 },
    vehicleId: args.vehicleId,
    reserve: true,
    release: false,
    activityContent: 'Oferta aceptada — Adria Coral',
    actorId: args.agentId,
    buyerLeadId: args.buyerLeadId,
    sellerLeadId: args.sellerLeadId,
  }
}

/** Barrera de dos partes: ambas transacciones se esperan antes del CAS del vehículo. */
function twoPartyBarrier() {
  let arriveA!: () => void
  let arriveB!: () => void
  const aArrived = new Promise<void>((r) => (arriveA = r))
  const bArrived = new Promise<void>((r) => (arriveB = r))
  return {
    hookA: {
      beforeVehicleWrite: async () => {
        arriveA()
        await bArrived
      },
    },
    hookB: {
      beforeVehicleWrite: async () => {
        arriveB()
        await aArrived
      },
    },
  }
}

beforeAll(() => {
  prisma = createGuardedTestPrisma()
})

afterEach(async () => {
  // LIFO: limpiar en orden inverso al de creación.
  for (const clean of cleanups.splice(0).reverse()) {
    await clean()
  }
})

afterAll(async () => {
  await prisma?.$disconnect()
})

describe('integración · reserva atómica de ofertas (carrera del mismo vehículo)', () => {
  it('dos aceptaciones concurrentes → 1 éxito, 1 conflicto "vehicle", 1 vehículo reservado, 1 oferta aceptada', async () => {
    const { agentId, sellerId, vehicleId, offers } = await seed({
      vehicleStatus: 'PUBLICADO',
      offers: [{}, {}], // dos ofertas PROPUESTA sobre el MISMO vehículo
    })
    const [oA, oB] = offers
    const { hookA, hookB } = twoPartyBarrier()

    const pA = prisma.$transaction(
      (tx) =>
        applyOfferStatusChangeTx(
          tx,
          acceptParams({
            offerId: oA.id,
            vehicleId,
            buyerLeadId: oA.buyerId,
            sellerLeadId: sellerId,
            agentId,
          }),
          hookA
        ),
      TX_OPTS
    )
    const pB = prisma.$transaction(
      (tx) =>
        applyOfferStatusChangeTx(
          tx,
          acceptParams({
            offerId: oB.id,
            vehicleId,
            buyerLeadId: oB.buyerId,
            sellerLeadId: sellerId,
            agentId,
          }),
          hookB
        ),
      TX_OPTS
    )

    const settled = await Promise.allSettled([pA, pB])
    const fulfilled = settled.filter((r) => r.status === 'fulfilled')
    const rejected = settled.filter((r) => r.status === 'rejected')

    // Exactamente un éxito y un conflicto controlado del vehículo.
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    const reason = (rejected[0] as PromiseRejectedResult).reason
    expect(reason).toBeInstanceOf(OfferConflictError)
    expect((reason as OfferConflictError).reason).toBe('vehicle')

    // Estado final consistente: 1 vehículo reservado, 1 oferta aceptada, 1 sigue en propuesta.
    const veh = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    expect(veh?.status).toBe('RESERVADO')

    const accepted = await prisma.offer.findMany({ where: { vehicleId, status: 'ACEPTADA' } })
    const proposals = await prisma.offer.findMany({ where: { vehicleId, status: 'PROPUESTA' } })
    expect(accepted).toHaveLength(1)
    expect(proposals).toHaveLength(1)
    expect(accepted[0].decidedAt).not.toBeNull()

    // Sin efectos duplicados ni parciales: solo las 2 trazas del ganador (comprador + vendedor).
    const buyerIds = offers.map((o) => o.buyerId)
    const acts = await prisma.activity.count({
      where: {
        type: 'OFERTA_ACTUALIZADA',
        OR: [{ sellerLeadId: sellerId }, { buyerLeadId: { in: buyerIds } }],
      },
    })
    expect(acts).toBe(2)

    // Invariante: como mucho una reserva viva por vehículo.
    expect(accepted.length).toBeLessThanOrEqual(1)
  })

  it('la MISMA oferta aceptada dos veces en concurrencia → 1 éxito y 1 conflicto "offer"', async () => {
    const { agentId, sellerId, vehicleId, offers } = await seed({
      vehicleStatus: 'PUBLICADO',
      offers: [{}], // una sola oferta
    })
    const only = offers[0]
    const params = acceptParams({
      offerId: only.id,
      vehicleId,
      buyerLeadId: only.buyerId,
      sellerLeadId: sellerId,
      agentId,
    })

    // Sin barrera: el conflicto ocurre en el CAS de la oferta (una sola fila). El
    // bloqueo de fila de PostgreSQL serializa; el perdedor relee y obtiene count 0.
    const settled = await Promise.allSettled([
      prisma.$transaction((tx) => applyOfferStatusChangeTx(tx, params), TX_OPTS),
      prisma.$transaction((tx) => applyOfferStatusChangeTx(tx, params), TX_OPTS),
    ])
    const fulfilled = settled.filter((r) => r.status === 'fulfilled')
    const rejected = settled.filter((r) => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    const reason = (rejected[0] as PromiseRejectedResult).reason
    expect(reason).toBeInstanceOf(OfferConflictError)
    expect((reason as OfferConflictError).reason).toBe('offer')

    // La oferta quedó ACEPTADA una sola vez y el vehículo reservado una sola vez.
    const offer = await prisma.offer.findUnique({ where: { id: only.id } })
    expect(offer?.status).toBe('ACEPTADA')
    const veh = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    expect(veh?.status).toBe('RESERVADO')

    // Solo 2 trazas (comprador + vendedor) del único intento exitoso — sin duplicados.
    const acts = await prisma.activity.count({
      where: {
        type: 'OFERTA_ACTUALIZADA',
        OR: [{ sellerLeadId: sellerId }, { buyerLeadId: only.buyerId }],
      },
    })
    expect(acts).toBe(2)
  })
})

describe('integración · atomicidad y rollback', () => {
  it('acepta sobre un vehículo NO publicable → conflicto y rollback total (oferta y vehículo intactos, sin trazas)', async () => {
    const { agentId, sellerId, vehicleId, offers } = await seed({
      vehicleStatus: 'TASADO', // no PUBLICADO → el CAS del vehículo afecta 0 filas
      offers: [{}],
    })
    const only = offers[0]
    const params = acceptParams({
      offerId: only.id,
      vehicleId,
      buyerLeadId: only.buyerId,
      sellerLeadId: sellerId,
      agentId,
    })

    await expect(
      prisma.$transaction((tx) => applyOfferStatusChangeTx(tx, params), TX_OPTS)
    ).rejects.toBeInstanceOf(OfferConflictError)

    // La transacción entera revierte: la oferta NO quedó aceptada…
    const offer = await prisma.offer.findUnique({ where: { id: only.id } })
    expect(offer?.status).toBe('PROPUESTA')
    expect(offer?.decidedAt).toBeNull()
    // …el vehículo sigue igual…
    const veh = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    expect(veh?.status).toBe('TASADO')
    // …y no se creó ninguna traza (efectos revertidos, sin estado parcial).
    const acts = await prisma.activity.count({
      where: {
        type: 'OFERTA_ACTUALIZADA',
        OR: [{ sellerLeadId: sellerId }, { buyerLeadId: only.buyerId }],
      },
    })
    expect(acts).toBe(0)
  })

  it('acepta sobre un vehículo publicado (camino feliz) → reserva y traza en ambos lados', async () => {
    const { agentId, sellerId, vehicleId, offers } = await seed({
      vehicleStatus: 'PUBLICADO',
      offers: [{}],
    })
    const only = offers[0]
    const result = await prisma.$transaction(
      (tx) =>
        applyOfferStatusChangeTx(
          tx,
          acceptParams({
            offerId: only.id,
            vehicleId,
            buyerLeadId: only.buyerId,
            sellerLeadId: sellerId,
            agentId,
          })
        ),
      TX_OPTS
    )
    expect(result).toEqual({ reserved: true, released: false })

    const veh = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    expect(veh?.status).toBe('RESERVADO')
    const offer = await prisma.offer.findUnique({ where: { id: only.id } })
    expect(offer?.status).toBe('ACEPTADA')
    expect(Number(offer?.depositAmount)).toBe(1000)

    const acts = await prisma.activity.count({
      where: {
        type: 'OFERTA_ACTUALIZADA',
        OR: [{ sellerLeadId: sellerId }, { buyerLeadId: only.buyerId }],
      },
    })
    expect(acts).toBe(2)
  })
})
