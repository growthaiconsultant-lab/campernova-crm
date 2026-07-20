/**
 * Tests de integración con PostgreSQL REAL (PR I2C) — transiciones coordinadas de oferta.
 *
 * Demuestran que archivar, aceptar y cancelar ya no pueden cruzarse, y que la **propiedad
 * inferida** de la reserva se sostiene: como máximo una oferta `ACEPTADA` por vehículo.
 *
 * Estados prohibidos que se consultan al final de cada carrera:
 *   · lead archivado  AND  oferta activa
 *   · dos ofertas ACEPTADA sobre el mismo vehículo
 *   · oferta ACEPTADA  AND  vehículo no RESERVADO
 *
 * Barreras deterministas y dos conexiones; sin `sleep` como mecanismo de sincronización.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { OfferStatus, PrismaClient, VehicleStatus } from '@prisma/client'
import { withLockedRoots, LockError, type LockRoot } from '@/lib/locking'
import {
  applyOfferTransitionTx,
  buildOfferTransitionRoots,
  isOfferTransitionError,
  type OfferTransitionErrorCode,
  type OfferTransitionHooks,
} from '@/lib/offers-transition'
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

type Fixture = {
  userId: string
  sellerId: string
  vehicleId: string
  buyerId: string
  offerA: string
  offerB: string
}

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
  const mk = async () =>
    (
      await prismaA.offer.create({
        data: {
          vehicleId: vehicle.id,
          buyerLeadId: buyer.id,
          amount: 25000,
          createdById: user.id,
        },
      })
    ).id

  const offerA = await mk()
  const offerB = await mk()

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

  return {
    userId: user.id,
    sellerId: seller.id,
    vehicleId: vehicle.id,
    buyerId: buyer.id,
    offerA,
    offerB,
  }
}

function transition(
  f: Fixture,
  offerId: string,
  toStatus: OfferStatus,
  client: PrismaClient,
  extra: { depositAmount?: number | null } = {},
  hooks: OfferTransitionHooks = {}
) {
  const roots = buildOfferTransitionRoots({
    vehicleId: f.vehicleId,
    sellerLeadId: f.sellerId,
    buyerLeadId: f.buyerId,
  })
  return withLockedRoots(
    roots,
    (tx) =>
      applyOfferTransitionTx(
        tx,
        {
          offerId,
          toStatus,
          resolvedVehicleId: f.vehicleId,
          resolvedBuyerLeadId: f.buyerId,
          resolvedSellerLeadId: f.sellerId,
          depositAmount: extra.depositAmount ?? null,
          actorId: f.userId,
        },
        hooks
      ),
    { client, lockTimeoutMs: 8_000 }
  )
}

/** Archivado con el protocolo futuro (I4/B2), sin importar código de PR #117. */
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
      const data = { archivedAt: new Date() }
      if (which === 'seller') {
        await tx.sellerLead.updateMany({ where: { id: f.sellerId, archivedAt: null }, data })
      } else {
        await tx.buyerLead.updateMany({ where: { id: f.buyerId, archivedAt: null }, data })
      }
      return { archived: true as const }
    },
    { client, lockTimeoutMs: 8_000 }
  )
}

const codeOf = (err: unknown): OfferTransitionErrorCode | null =>
  isOfferTransitionError(err) ? err.code : null

/** Los tres estados prohibidos, consultados al final de cada carrera. */
async function forbiddenState(f: Fixture) {
  const [seller, buyer, vehicle, aceptadas, activas] = await Promise.all([
    prismaA.sellerLead.findUniqueOrThrow({ where: { id: f.sellerId } }),
    prismaA.buyerLead.findUniqueOrThrow({ where: { id: f.buyerId } }),
    prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } }),
    prismaA.offer.count({ where: { vehicleId: f.vehicleId, status: 'ACEPTADA' } }),
    prismaA.offer.count({
      where: {
        vehicleId: f.vehicleId,
        status: { in: ['PROPUESTA', 'CONTRAOFERTA', 'ACEPTADA'] },
      },
    }),
  ])
  return {
    archivadoConOfertaActiva:
      (seller.archivedAt != null || buyer.archivedAt != null) && activas > 0,
    dosAceptadas: aceptadas > 1,
    aceptadaSinReserva: aceptadas === 1 && vehicle.status !== 'RESERVADO',
    aceptadas,
    vehicleStatus: vehicle.status,
  }
}

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

describe('propiedad de la reserva: como máximo una ACEPTADA por vehículo', () => {
  it('aceptación secuencial: la segunda recibe RESERVATION_ALREADY_OWNED', async () => {
    const f = await seed()

    await transition(f, f.offerA, 'ACEPTADA', prismaA, { depositAmount: 1000 })
    // El vehículo queda RESERVADO, así que B falla por disponibilidad antes incluso de la
    // comprobación de propiedad; ambas barreras protegen el mismo invariante.
    const err = await transition(f, f.offerB, 'ACEPTADA', prismaB).catch((e) => e)

    expect(['VEHICLE_NOT_AVAILABLE', 'RESERVATION_ALREADY_OWNED']).toContain(codeOf(err))
    const st = await forbiddenState(f)
    expect(st.aceptadas).toBe(1)
    expect(st.vehicleStatus).toBe('RESERVADO')
    expect(st.dosAceptadas).toBe(false)
  })

  it('la propiedad se comprueba aunque el vehículo esté PUBLICADO de forma incoherente', async () => {
    // Estado anómalo fabricado con SQL de test: A ACEPTADA pero vehículo PUBLICADO — es lo que
    // hoy puede producir la edición manual de `updateVehicle`, que I3 debe eliminar.
    const f = await seed()
    await transition(f, f.offerA, 'ACEPTADA', prismaA, { depositAmount: 1000 })
    await prismaA.vehicle.update({
      where: { id: f.vehicleId },
      data: { status: 'PUBLICADO' },
    })

    const err = await transition(f, f.offerB, 'ACEPTADA', prismaB).catch((e) => e)

    expect(codeOf(err)).toBe('RESERVATION_ALREADY_OWNED')
    const st = await forbiddenState(f)
    expect(st.aceptadas).toBe(1)
    expect(st.dosAceptadas).toBe(false)
  })

  it('dos aceptaciones concurrentes: solo una gana', async () => {
    const f = await seed()

    const results = await Promise.allSettled([
      transition(f, f.offerA, 'ACEPTADA', prismaA, { depositAmount: 1000 }),
      transition(f, f.offerB, 'ACEPTADA', prismaB, { depositAmount: 2000 }),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)

    const st = await forbiddenState(f)
    expect(st.aceptadas).toBe(1)
    expect(st.vehicleStatus).toBe('RESERVADO')
    expect(st.dosAceptadas).toBe(false)
    expect(st.aceptadaSinReserva).toBe(false)

    // La perdedora no dejó traza: la ganadora escribe UNA Activity por lado (una con
    // `buyerLeadId` y otra con `sellerLeadId`), así que cada lado debe contar exactamente 1.
    expect(await prismaA.activity.count({ where: { buyerLeadId: f.buyerId } })).toBe(1)
    expect(await prismaA.activity.count({ where: { sellerLeadId: f.sellerId } })).toBe(1)
  })

  it('cancelar con otra ACEPTADA anómala falla cerrado y no libera', async () => {
    const f = await seed()
    // Se siembran DOS ACEPTADA con SQL de test — inalcanzable por el dominio, alcanzable hoy por
    // la edición manual del vehículo.
    await prismaA.offer.updateMany({
      where: { id: { in: [f.offerA, f.offerB] } },
      data: { status: 'ACEPTADA' },
    })
    await prismaA.vehicle.update({ where: { id: f.vehicleId }, data: { status: 'RESERVADO' } })
    const activitiesAntes = await prismaA.activity.count({ where: { buyerLeadId: f.buyerId } })

    const err = await transition(f, f.offerA, 'CANCELADA', prismaA).catch((e) => e)

    expect(codeOf(err)).toBe('RESERVATION_OWNERSHIP_CONFLICT')
    const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })
    expect(vehicle.status).toBe('RESERVADO') // no se liberó la reserva ajena
    const a = await prismaA.offer.findUniqueOrThrow({ where: { id: f.offerA } })
    expect(a.status).toBe('ACEPTADA') // no se canceló
    expect(await prismaA.activity.count({ where: { buyerLeadId: f.buyerId } })).toBe(
      activitiesAntes
    )
  })
})

describe('cancelación y estado del vehículo', () => {
  it('con el vehículo RESERVADO: cancela y libera', async () => {
    const f = await seed()
    await transition(f, f.offerA, 'ACEPTADA', prismaA, { depositAmount: 1000 })

    await transition(f, f.offerA, 'CANCELADA', prismaA)

    const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })
    expect(vehicle.status).toBe('PUBLICADO')
    const a = await prismaA.offer.findUniqueOrThrow({ where: { id: f.offerA } })
    expect(a.status).toBe('CANCELADA')
  })

  it('con el vehículo ya PUBLICADO: cancela sin tocar el vehículo', async () => {
    const f = await seed()
    await transition(f, f.offerA, 'ACEPTADA', prismaA, { depositAmount: 1000 })
    await prismaA.vehicle.update({ where: { id: f.vehicleId }, data: { status: 'PUBLICADO' } })

    await transition(f, f.offerA, 'CANCELADA', prismaA)

    const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })
    expect(vehicle.status).toBe('PUBLICADO')
    const a = await prismaA.offer.findUniqueOrThrow({ where: { id: f.offerA } })
    expect(a.status).toBe('CANCELADA')
  })

  it.each(['VENDIDO', 'DESCARTADO'] as VehicleStatus[])(
    'con el vehículo en %s falla cerrado y no cambia nada',
    async (status) => {
      const f = await seed()
      await transition(f, f.offerA, 'ACEPTADA', prismaA, { depositAmount: 1000 })
      await prismaA.vehicle.update({ where: { id: f.vehicleId }, data: { status } })

      const err = await transition(f, f.offerA, 'CANCELADA', prismaA).catch((e) => e)

      expect(codeOf(err)).toBe('VEHICLE_RESERVATION_STATE_CONFLICT')
      const a = await prismaA.offer.findUniqueOrThrow({ where: { id: f.offerA } })
      expect(a.status).toBe('ACEPTADA')
      const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })
      expect(vehicle.status).toBe(status)
    }
  )

  it('cancelación antigua vs aceptación nueva: nunca ACEPTADA con vehículo PUBLICADO', async () => {
    const f = await seed()
    await transition(f, f.offerA, 'ACEPTADA', prismaA, { depositAmount: 1000 })

    const cancelLocked = barrier()
    const releaseCancel = barrier()

    const cancel = transition(
      f,
      f.offerA,
      'CANCELADA',
      prismaA,
      {},
      {
        beforeWrite: async () => {
          cancelLocked.open()
          await releaseCancel.wait
        },
      }
    )
    await cancelLocked.wait

    // B intenta aceptar mientras A retiene las raíces: espera al lock.
    const accept = transition(f, f.offerB, 'ACEPTADA', prismaB, { depositAmount: 2000 }).catch(
      (e) => e
    )
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r))

    releaseCancel.open()
    await cancel
    const acceptRes = await accept

    const st = await forbiddenState(f)
    expect(st.dosAceptadas).toBe(false)
    expect(st.aceptadaSinReserva).toBe(false)
    // Si B logró aceptar fue después de liberarse la reserva; si no, falló limpiamente.
    if (isOfferTransitionError(acceptRes)) {
      expect(st.aceptadas).toBe(0)
      expect(st.vehicleStatus).toBe('PUBLICADO')
    } else {
      expect(st.aceptadas).toBe(1)
      expect(st.vehicleStatus).toBe('RESERVADO')
    }
  })
})

describe('archivado vs transición', () => {
  it('comprador archivado antes: aceptar recibe LEAD_ARCHIVED y no toca el stock', async () => {
    const f = await seed()
    await prismaA.buyerLead.update({
      where: { id: f.buyerId },
      data: { archivedAt: new Date() },
    })

    const err = await transition(f, f.offerA, 'ACEPTADA', prismaA, { depositAmount: 1000 }).catch(
      (e) => e
    )

    expect(codeOf(err)).toBe('LEAD_ARCHIVED')
    const st = await forbiddenState(f)
    expect(st.aceptadas).toBe(0)
    expect(st.vehicleStatus).toBe('PUBLICADO')
  })

  it('vendedor archivado antes: aceptar recibe LEAD_ARCHIVED', async () => {
    const f = await seed()
    await prismaA.sellerLead.update({
      where: { id: f.sellerId },
      data: { archivedAt: new Date() },
    })

    const err = await transition(f, f.offerA, 'ACEPTADA', prismaA, { depositAmount: 1000 }).catch(
      (e) => e
    )
    expect(codeOf(err)).toBe('LEAD_ARCHIVED')
  })

  it('aceptación en curso vs archivado: uno gana, nunca ambos', async () => {
    const f = await seed()

    const accepting = barrier()
    const releaseAccept = barrier()

    const accept = transition(
      f,
      f.offerA,
      'ACEPTADA',
      prismaA,
      { depositAmount: 1000 },
      {
        beforeWrite: async () => {
          accepting.open()
          await releaseAccept.wait
        },
      }
    )
    await accepting.wait

    const archive = archiveLead(f, 'buyer', prismaB)
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r))

    releaseAccept.open()
    const [acceptRes, archiveRes] = await Promise.all([accept, archive])

    expect(acceptRes.toStatus).toBe('ACEPTADA')
    expect(archiveRes.archived).toBe(false) // ve la oferta activa tras adquirir el lock
    const st = await forbiddenState(f)
    expect(st.archivadoConOfertaActiva).toBe(false)
  })
})

describe('atomicidad y coordinación', () => {
  it('un fallo en la escritura del vehículo revierte también la oferta', async () => {
    const f = await seed()
    const boom = new Error('fallo simulado entre la oferta y el vehículo')

    const err = await transition(
      f,
      f.offerA,
      'ACEPTADA',
      prismaA,
      { depositAmount: 1000 },
      {
        beforeVehicleWrite: async () => {
          throw boom
        },
      }
    ).catch((e) => e)

    expect(err).toBe(boom)
    const a = await prismaA.offer.findUniqueOrThrow({ where: { id: f.offerA } })
    expect(a.status).toBe('PROPUESTA')
    const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })
    expect(vehicle.status).toBe('PUBLICADO')
    expect(await prismaA.activity.count({ where: { buyerLeadId: f.buyerId } })).toBe(0)
  })

  it('la señal se persiste en la misma transacción que el estado y el stock', async () => {
    const f = await seed()
    await transition(f, f.offerA, 'ACEPTADA', prismaA, { depositAmount: 1500 })

    const a = await prismaA.offer.findUniqueOrThrow({ where: { id: f.offerA } })
    const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })
    expect(a.status).toBe('ACEPTADA')
    expect(Number(a.depositAmount)).toBe(1500)
    expect(vehicle.status).toBe('RESERVADO')
  })

  it('transición terminal desde PROPUESTA no toca el stock', async () => {
    const f = await seed()
    await transition(f, f.offerA, 'RECHAZADA', prismaA)

    const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })
    expect(vehicle.status).toBe('PUBLICADO')
  })

  it('lock ocupado más allá del timeout → LOCK_TIMEOUT sin cambiar nada', async () => {
    const f = await seed()

    const locked = barrier()
    const release = barrier()

    const first = transition(
      f,
      f.offerA,
      'ACEPTADA',
      prismaA,
      { depositAmount: 1000 },
      {
        beforeWrite: async () => {
          locked.open()
          await release.wait
        },
      }
    )
    await locked.wait

    const err = await withLockedRoots(
      buildOfferTransitionRoots({
        vehicleId: f.vehicleId,
        sellerLeadId: f.sellerId,
        buyerLeadId: f.buyerId,
      }),
      async () => 'nunca',
      { client: prismaB, lockTimeoutMs: 300 }
    ).catch((e) => e)

    release.open()
    await first

    expect(err).toBeInstanceOf(LockError)
    expect((err as LockError).code).toBe('LOCK_TIMEOUT')
  })
})
