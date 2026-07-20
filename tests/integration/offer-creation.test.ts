/**
 * Tests de integración con PostgreSQL REAL (PR I2B) — creación coordinada de ofertas.
 *
 * Demuestran que archivar un lead y registrar una oferta ya no pueden cruzarse: uno de los dos
 * gana y el otro recibe un error de dominio, pero el estado prohibido
 *
 *     lead archivado  AND  oferta activa asociada
 *
 * no ocurre nunca. El solapamiento se fuerza con BARRERAS deterministas y DOS conexiones; los
 * hooks de `createOfferTx` permiten detener la transacción justo antes de escribir.
 *
 * El lado del archivado ejecuta aquí el protocolo futuro (raíces + update de `archivedAt`)
 * directamente, sin importar nada de PR #117, que sigue sin fusionar.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient, VehicleStatus } from '@prisma/client'
import { withLockedRoots, LockError, type LockRoot } from '@/lib/locking'
import {
  buildOfferCreationRoots,
  createOfferTx,
  isOfferCreationError,
  type OfferCreationErrorCode,
} from '@/lib/offers-creation'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prismaA: PrismaClient
let prismaB: PrismaClient
const cleanups: Array<() => Promise<void>> = []

function barrier() {
  let open!: () => void
  const wait = new Promise<void>((resolve) => {
    open = resolve
  })
  return { wait, open }
}

type Fixture = { userId: string; sellerId: string; vehicleId: string; buyerId: string }

async function seed(vehicleStatus: VehicleStatus = 'PUBLICADO'): Promise<Fixture> {
  const s = uniqueSuffix()
  const user = await prismaA.user.create({
    data: { name: `U ${s}`, email: `u_${s}@integ.test`, role: 'AGENTE' },
  })
  const seller = await prismaA.sellerLead.create({
    data: { name: `S ${s}`, email: `s_${s}@integ.test`, phone: '600000000' },
  })
  const vehicle = await prismaA.vehicle.create({
    data: {
      sellerLeadId: seller.id,
      brand: 'Adria',
      model: 'Coral',
      year: 2020,
      km: 1000,
      seats: 4,
      type: 'AUTOCARAVANA',
      status: vehicleStatus,
    },
  })
  const buyer = await prismaA.buyerLead.create({
    data: { name: `B ${s}`, email: `b_${s}@integ.test`, phone: '600000001' },
  })

  cleanups.push(async () => {
    await prismaA.activity.deleteMany({
      where: { OR: [{ sellerLeadId: seller.id }, { buyerLeadId: buyer.id }] },
    })
    await prismaA.offer.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prismaA.sellerLead.deleteMany({ where: { id: seller.id } })
    await prismaA.buyerLead.deleteMany({ where: { id: buyer.id } })
    await prismaA.user.deleteMany({ where: { id: user.id } })
  })

  return { userId: user.id, sellerId: seller.id, vehicleId: vehicle.id, buyerId: buyer.id }
}

/** Alta de oferta con el protocolo de I2B, con hooks para forzar el interleaving. */
function createOffer(
  f: Fixture,
  client: PrismaClient,
  hooks: Parameters<typeof createOfferTx>[2] = {}
) {
  const roots = buildOfferCreationRoots({
    vehicleId: f.vehicleId,
    sellerLeadId: f.sellerId,
    buyerLeadId: f.buyerId,
  })
  return withLockedRoots(
    roots,
    (tx) =>
      createOfferTx(
        tx,
        {
          vehicleId: f.vehicleId,
          buyerLeadId: f.buyerId,
          resolvedSellerLeadId: f.sellerId,
          matchId: null,
          amount: 25000,
          notes: null,
          actorId: f.userId,
        },
        hooks
      ),
    { client, lockTimeoutMs: 8_000 }
  )
}

/**
 * Archivado con el protocolo FUTURO (I4/B2): bloquea las mismas raíces, comprueba que no haya
 * oferta activa y escribe `archivedAt`. No importa código de PR #117.
 */
function archiveLead(
  f: Fixture,
  which: 'buyer' | 'seller',
  client: PrismaClient,
  hooks: { beforeWrite?: () => Promise<void> } = {}
) {
  const roots: LockRoot[] =
    which === 'seller'
      ? [
          { type: 'vehicle', id: f.vehicleId },
          { type: 'sellerLead', id: f.sellerId },
        ]
      : [{ type: 'buyerLead', id: f.buyerId }]

  return withLockedRoots(
    roots,
    async (tx) => {
      const activas = await tx.offer.count({
        where: {
          status: { in: ['PROPUESTA', 'CONTRAOFERTA', 'ACEPTADA'] },
          ...(which === 'seller' ? { vehicleId: f.vehicleId } : { buyerLeadId: f.buyerId }),
        },
      })
      if (activas > 0) return { archived: false as const }

      await hooks.beforeWrite?.()

      if (which === 'seller') {
        await tx.sellerLead.updateMany({
          where: { id: f.sellerId, archivedAt: null },
          data: { archivedAt: new Date() },
        })
      } else {
        await tx.buyerLead.updateMany({
          where: { id: f.buyerId, archivedAt: null },
          data: { archivedAt: new Date() },
        })
      }
      return { archived: true as const }
    },
    { client, lockTimeoutMs: 8_000 }
  )
}

/** El estado prohibido: lead archivado con oferta activa asociada. */
async function invariantBroken(f: Fixture): Promise<boolean> {
  const [seller, buyer, activas] = await Promise.all([
    prismaA.sellerLead.findUniqueOrThrow({ where: { id: f.sellerId } }),
    prismaA.buyerLead.findUniqueOrThrow({ where: { id: f.buyerId } }),
    prismaA.offer.count({
      where: { vehicleId: f.vehicleId, status: { in: ['PROPUESTA', 'CONTRAOFERTA', 'ACEPTADA'] } },
    }),
  ])
  return (seller.archivedAt != null || buyer.archivedAt != null) && activas > 0
}

const codeOf = (err: unknown): OfferCreationErrorCode | null =>
  isOfferCreationError(err) ? err.code : null

beforeAll(() => {
  prismaA = createGuardedTestPrisma()
  prismaB = createGuardedTestPrisma()
})

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!()
})

afterAll(async () => {
  await Promise.all([prismaA.$disconnect(), prismaB.$disconnect()])
})

describe('archivado vs creación de oferta', () => {
  it('comprador: uno de los dos gana, nunca ambos', async () => {
    const f = await seed()

    const offerLocked = barrier()
    const releaseOffer = barrier()

    // A registra la oferta y se detiene con las raíces ya bloqueadas.
    const alta = createOffer(f, prismaA, {
      beforeOfferWrite: async () => {
        offerLocked.open()
        await releaseOffer.wait
      },
    })
    await offerLocked.wait

    // B intenta archivar al comprador: espera al lock de A.
    const archivado = archiveLead(f, 'buyer', prismaB)
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r))

    releaseOffer.open()
    const [resAlta, resArchivado] = await Promise.all([alta, archivado])

    // La oferta se creó y el archivado, al releer, ve la oferta activa y no archiva.
    expect(resAlta.offerId).toBeTruthy()
    expect(resArchivado.archived).toBe(false)
    expect(await invariantBroken(f)).toBe(false)
  })

  it('comprador archivado primero: la oferta se rechaza con LEAD_ARCHIVED', async () => {
    const f = await seed()

    const archivedDone = barrier()
    const releaseArchive = barrier()

    const archivado = archiveLead(f, 'buyer', prismaA, {
      beforeWrite: async () => {
        archivedDone.open()
        await releaseArchive.wait
      },
    })
    await archivedDone.wait

    const alta = createOffer(f, prismaB).catch((e) => e)
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r))

    releaseArchive.open()
    const [resArchivado, resAlta] = await Promise.all([archivado, alta])

    expect(resArchivado.archived).toBe(true)
    expect(codeOf(resAlta)).toBe('LEAD_ARCHIVED')
    expect(await prismaA.offer.count({ where: { vehicleId: f.vehicleId } })).toBe(0)
    expect(await invariantBroken(f)).toBe(false)
  })

  it('vendedor archivado primero: la oferta se rechaza con LEAD_ARCHIVED', async () => {
    const f = await seed()

    const archivedDone = barrier()
    const releaseArchive = barrier()

    const archivado = archiveLead(f, 'seller', prismaA, {
      beforeWrite: async () => {
        archivedDone.open()
        await releaseArchive.wait
      },
    })
    await archivedDone.wait

    const alta = createOffer(f, prismaB).catch((e) => e)
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r))

    releaseArchive.open()
    const [resArchivado, resAlta] = await Promise.all([archivado, alta])

    expect(resArchivado.archived).toBe(true)
    expect(codeOf(resAlta)).toBe('LEAD_ARCHIVED')
    expect(await prismaA.offer.count({ where: { vehicleId: f.vehicleId } })).toBe(0)
    expect(await invariantBroken(f)).toBe(false)
  })

  it('vendedor: alta en curso bloquea el archivado hasta que termina', async () => {
    const f = await seed()

    const offerLocked = barrier()
    const releaseOffer = barrier()
    let archivadoEntro = false

    const alta = createOffer(f, prismaA, {
      beforeOfferWrite: async () => {
        offerLocked.open()
        await releaseOffer.wait
      },
    })
    await offerLocked.wait

    const archivado = archiveLead(f, 'seller', prismaB).then((r) => {
      archivadoEntro = true
      return r
    })
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r))
    // El archivado no puede haber terminado: A retiene Vehicle y SellerLead.
    expect(archivadoEntro).toBe(false)

    releaseOffer.open()
    const [resAlta, resArchivado] = await Promise.all([alta, archivado])

    expect(resAlta.offerId).toBeTruthy()
    expect(resArchivado.archived).toBe(false)
    expect(await invariantBroken(f)).toBe(false)
  })
})

describe('la raíz cambia entre resolución y relectura', () => {
  it('el vehículo pasa a otro vendedor → OFFER_ROOT_CHANGED, sin escribir nada', async () => {
    const f = await seed()
    const s = uniqueSuffix()
    const otroVendedor = await prismaA.sellerLead.create({
      data: { name: `S2 ${s}`, email: `s2_${s}@integ.test`, phone: '600000002' },
    })
    cleanups.push(async () => {
      await prismaA.sellerLead.deleteMany({ where: { id: otroVendedor.id } })
    })

    // Simula que el vehículo cambió de vendedor DESPUÉS de la lectura preliminar: se pasa como
    // `resolvedSellerLeadId` el vendedor antiguo mientras la fila ya apunta a otro.
    await prismaA.vehicle.update({
      where: { id: f.vehicleId },
      data: { sellerLeadId: otroVendedor.id },
    })

    const err = await withLockedRoots(
      buildOfferCreationRoots({
        vehicleId: f.vehicleId,
        sellerLeadId: f.sellerId,
        buyerLeadId: f.buyerId,
      }),
      (tx) =>
        createOfferTx(tx, {
          vehicleId: f.vehicleId,
          buyerLeadId: f.buyerId,
          resolvedSellerLeadId: f.sellerId, // raíz vieja
          matchId: null,
          amount: 25000,
          notes: null,
          actorId: f.userId,
        }),
      { client: prismaA }
    ).catch((e) => e)

    expect(codeOf(err)).toBe('OFFER_ROOT_CHANGED')
    expect(await prismaA.offer.count({ where: { vehicleId: f.vehicleId } })).toBe(0)
    expect(await prismaA.activity.count({ where: { buyerLeadId: f.buyerId } })).toBe(0)

    // Devuelve el vehículo a su vendedor para que el cleanup ordinario funcione.
    await prismaA.vehicle.update({
      where: { id: f.vehicleId },
      data: { sellerLeadId: f.sellerId },
    })
  })
})

describe('estado del vehículo', () => {
  it.each(['TASADO', 'PUBLICADO', 'RESERVADO'] as VehicleStatus[])(
    'permite crear con el vehículo en %s',
    async (status) => {
      const f = await seed(status)
      const res = await createOffer(f, prismaA)
      expect(res.offerId).toBeTruthy()

      const offer = await prismaA.offer.findUniqueOrThrow({ where: { id: res.offerId } })
      expect(offer.status).toBe('PROPUESTA')

      // Crear NO toca el stock.
      const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })
      expect(vehicle.status).toBe(status)
    }
  )

  it.each(['NUEVO', 'VENDIDO', 'DESCARTADO'] as VehicleStatus[])(
    'rechaza con el vehículo en %s y no deja rastro',
    async (status) => {
      const f = await seed(status)
      const err = await createOffer(f, prismaA).catch((e) => e)

      expect(codeOf(err)).toBe('VEHICLE_NOT_AVAILABLE')
      expect(await prismaA.offer.count({ where: { vehicleId: f.vehicleId } })).toBe(0)
      expect(await prismaA.activity.count({ where: { buyerLeadId: f.buyerId } })).toBe(0)
    }
  )
})

describe('atomicidad y concurrencia ordinaria', () => {
  it('Offer y Activity se confirman juntas', async () => {
    const f = await seed()
    const res = await createOffer(f, prismaA)

    expect(await prismaA.offer.count({ where: { id: res.offerId } })).toBe(1)
    // Una traza por lado: comprador y vendedor.
    expect(await prismaA.activity.count({ where: { buyerLeadId: f.buyerId } })).toBe(1)
    expect(await prismaA.activity.count({ where: { sellerLeadId: f.sellerId } })).toBe(1)
  })

  it('si falla la escritura de la Activity, la oferta revierte', async () => {
    const f = await seed()
    const boom = new Error('fallo simulado al escribir la traza')

    const err = await createOffer(f, prismaA, {
      beforeActivityWrite: async () => {
        throw boom
      },
    }).catch((e) => e)

    expect(err).toBe(boom)
    expect(await prismaA.offer.count({ where: { vehicleId: f.vehicleId } })).toBe(0)
    expect(await prismaA.activity.count({ where: { buyerLeadId: f.buyerId } })).toBe(0)
  })

  it('dos altas concurrentes sobre el mismo vehículo: ambas válidas y serializadas', async () => {
    // Las negociaciones paralelas están permitidas por el dominio; I2B no las restringe.
    const f = await seed()

    const [a, b] = await Promise.all([createOffer(f, prismaA), createOffer(f, prismaB)])

    expect(a.offerId).not.toBe(b.offerId)
    expect(await prismaA.offer.count({ where: { vehicleId: f.vehicleId } })).toBe(2)
    // Ninguna reservó nada: ambas nacen en PROPUESTA.
    const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })
    expect(vehicle.status).toBe('PUBLICADO')
  })

  it('lock ocupado más allá del timeout → LOCK_TIMEOUT sin crear nada', async () => {
    const f = await seed()

    const locked = barrier()
    const release = barrier()

    const alta = createOffer(f, prismaA, {
      beforeOfferWrite: async () => {
        locked.open()
        await release.wait
      },
    })
    await locked.wait

    const err = await withLockedRoots(
      buildOfferCreationRoots({
        vehicleId: f.vehicleId,
        sellerLeadId: f.sellerId,
        buyerLeadId: f.buyerId,
      }),
      async () => 'nunca',
      { client: prismaB, lockTimeoutMs: 300 }
    ).catch((e) => e)

    release.open()
    await alta

    expect(err).toBeInstanceOf(LockError)
    expect((err as LockError).code).toBe('LOCK_TIMEOUT')
  })
})
