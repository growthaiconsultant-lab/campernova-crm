/**
 * Tests de integración con PostgreSQL REAL (PR I3A) — CAS del cambio manual de estado.
 *
 * Demuestran que `updateVehicle` ya no puede pisar un cambio de estado ajeno: la escritura va
 * condicionada al estado releído, de modo que si otro dominio movió el vehículo entre la lectura
 * y el commit, la operación falla cerrada y no deja traza.
 *
 * Estado prohibido que se consulta al final de cada carrera:
 *   · oferta ACEPTADA  AND  vehículo no RESERVADO
 *
 * Barreras deterministas y dos conexiones; sin `sleep` como mecanismo de sincronización.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient, VehicleStatus } from '@prisma/client'
import { withLockedRoots } from '@/lib/locking'
import { applyOfferTransitionTx, buildOfferTransitionRoots } from '@/lib/offers-transition'
import {
  applyManualVehicleUpdateTx,
  applyVehicleUpdateTx,
  buildVehicleUpdateRoots,
  isVehicleStatusConflict,
  isVehicleUpdateError,
  type ManualVehicleUpdateHooks,
  type VehicleUpdateHooks,
} from '@/lib/vehicle-status'
import { LockError } from '@/lib/locking'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prismaA: PrismaClient
let prismaB: PrismaClient
/** Tercera conexión, solo observa: no participa en las carreras. */
let prismaObs: PrismaClient
const cleanups: Array<() => Promise<void>> = []

function barrier() {
  let open!: () => void
  const wait = new Promise<void>((resolve) => {
    open = resolve
  })
  return { wait, open }
}

/**
 * Espera a que **otra** sesión quede bloqueada esperando un lock. Prueba positiva de contención:
 * si nadie llega a esperar dentro del plazo, lanza y el test falla.
 */
async function waitUntilBlocked(timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const rows = await prismaObs.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND wait_event_type = 'Lock'`
    if ((rows[0]?.n ?? 0) > 0) return
    if (Date.now() > deadline) {
      throw new Error('la otra operación nunca llegó a esperar un lock: contención no demostrada')
    }
    await new Promise((r) => setTimeout(r, 25))
  }
}

type Fixture = {
  userId: string
  sellerId: string
  vehicleId: string
  buyerId: string
  offerId: string
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
  const offer = await prismaA.offer.create({
    data: { vehicleId: vehicle.id, buyerLeadId: buyer.id, amount: 25000, createdById: user.id },
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

  return {
    userId: user.id,
    sellerId: seller.id,
    vehicleId: vehicle.id,
    buyerId: buyer.id,
    offerId: offer.id,
  }
}

/** Edición manual del vehículo, tal y como la ejecuta `updateVehicle` tras validar. */
function manualUpdate(
  f: Fixture,
  expectedStatus: VehicleStatus,
  nextStatus: VehicleStatus,
  client: PrismaClient,
  hooks: VehicleUpdateHooks = {},
  actorId?: string
) {
  return client.$transaction((tx) =>
    applyVehicleUpdateTx(
      tx,
      {
        vehicleId: f.vehicleId,
        expectedStatus,
        nextStatus,
        sellerLeadId: f.sellerId,
        actorId: actorId ?? f.userId,
        activityContent: `Vehículo: ${expectedStatus} → ${nextStatus}`,
        data: { status: nextStatus, km: 1234 },
      },
      hooks
    )
  )
}

/** Edición manual COORDINADA (I3B): `withLockedRoots` + relectura + CAS, como en `updateVehicle`. */
function coordinatedUpdate(
  f: Fixture,
  nextStatus: VehicleStatus,
  client: PrismaClient,
  opts: {
    resolvedSellerLeadId?: string | null
    hooks?: ManualVehicleUpdateHooks
    lockTimeoutMs?: number
    actorId?: string
  } = {}
) {
  const resolved = opts.resolvedSellerLeadId === undefined ? f.sellerId : opts.resolvedSellerLeadId
  const roots = buildVehicleUpdateRoots({ vehicleId: f.vehicleId, sellerLeadId: resolved })
  return withLockedRoots(
    roots,
    (tx) =>
      applyManualVehicleUpdateTx(
        tx,
        {
          vehicleId: f.vehicleId,
          resolvedSellerLeadId: resolved,
          nextStatus,
          actorId: opts.actorId ?? f.userId,
          activityContent: (from) => `Vehículo: ${from} → ${nextStatus}`,
          data: { status: nextStatus, km: 1234 },
        },
        opts.hooks
      ),
    { client, lockTimeoutMs: opts.lockTimeoutMs ?? 8_000 }
  )
}

/** Archivado del vendedor con el protocolo futuro (I4/B2), sin importar código de PR #117. */
function archiveSeller(
  f: Fixture,
  client: PrismaClient,
  hooks: { beforeWrite?: () => Promise<void> } = {}
) {
  const roots = buildVehicleUpdateRoots({ vehicleId: f.vehicleId, sellerLeadId: f.sellerId })
  return withLockedRoots(
    roots,
    async (tx) => {
      await hooks.beforeWrite?.()
      await tx.sellerLead.updateMany({
        where: { id: f.sellerId, archivedAt: null },
        data: { archivedAt: new Date() },
      })
    },
    { client, lockTimeoutMs: 8_000 }
  )
}

/** Aceptación de oferta por el dominio propietario (I2B/I2C), con sus locks de raíz. */
function acceptOffer(f: Fixture, client: PrismaClient) {
  const roots = buildOfferTransitionRoots({
    vehicleId: f.vehicleId,
    sellerLeadId: f.sellerId,
    buyerLeadId: f.buyerId,
  })
  return withLockedRoots(
    roots,
    (tx) =>
      applyOfferTransitionTx(tx, {
        offerId: f.offerId,
        toStatus: 'ACEPTADA',
        resolvedVehicleId: f.vehicleId,
        resolvedBuyerLeadId: f.buyerId,
        resolvedSellerLeadId: f.sellerId,
        depositAmount: 1000,
        actorId: f.userId,
      }),
    { client, lockTimeoutMs: 8_000 }
  )
}

async function finalState(f: Fixture) {
  const [vehicle, offer, activities] = await Promise.all([
    prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } }),
    prismaA.offer.findUniqueOrThrow({ where: { id: f.offerId } }),
    prismaA.activity.count({ where: { sellerLeadId: f.sellerId, type: 'CAMBIO_ESTADO' } }),
  ])
  return {
    vehicleStatus: vehicle.status,
    km: vehicle.km,
    offerStatus: offer.status,
    cambiosEstado: activities,
    aceptadaSinReserva: offer.status === 'ACEPTADA' && vehicle.status !== 'RESERVADO',
  }
}

beforeAll(() => {
  prismaA = createGuardedTestPrisma()
  prismaB = createGuardedTestPrisma()
  prismaObs = createGuardedTestPrisma()
})

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!()
})

afterAll(async () => {
  await Promise.all([prismaA.$disconnect(), prismaB.$disconnect(), prismaObs.$disconnect()])
})

describe('CAS del cambio manual de estado', () => {
  it('con el estado esperado intacto: escribe vehículo y traza', async () => {
    const f = await seed('TASADO')

    const res = await manualUpdate(f, 'TASADO', 'PUBLICADO', prismaA)

    expect(res.statusChanged).toBe(true)
    const st = await finalState(f)
    expect(st.vehicleStatus).toBe('PUBLICADO')
    expect(st.km).toBe(1234)
    expect(st.cambiosEstado).toBe(1)
  })

  it('sin cambio de estado: escribe campos pero no genera traza', async () => {
    const f = await seed('PUBLICADO')

    const res = await manualUpdate(f, 'PUBLICADO', 'PUBLICADO', prismaA)

    expect(res.statusChanged).toBe(false)
    const st = await finalState(f)
    expect(st.km).toBe(1234)
    expect(st.cambiosEstado).toBe(0)
  })

  it('estado obsoleto: el CAS falla y no deja traza', async () => {
    const f = await seed('TASADO')
    // Otra operación adelanta el vehículo mientras el primer caller aún cree que está TASADO.
    await prismaA.vehicle.update({ where: { id: f.vehicleId }, data: { status: 'PUBLICADO' } })

    const err = await manualUpdate(f, 'TASADO', 'DESCARTADO', prismaA).catch((e) => e)

    expect(isVehicleStatusConflict(err)).toBe(true)
    const st = await finalState(f)
    expect(st.vehicleStatus).toBe('PUBLICADO')
    expect(st.km).not.toBe(1234)
    expect(st.cambiosEstado).toBe(0)
  })

  it('dos ediciones concurrentes sobre el mismo estado: solo una gana', async () => {
    const f = await seed('TASADO')

    const results = await Promise.allSettled([
      manualUpdate(f, 'TASADO', 'PUBLICADO', prismaA),
      manualUpdate(f, 'TASADO', 'DESCARTADO', prismaB),
    ])

    const ok = results.filter((r) => r.status === 'fulfilled')
    const ko = results.filter((r) => r.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(ko).toHaveLength(1)
    expect(isVehicleStatusConflict((ko[0] as PromiseRejectedResult).reason)).toBe(true)

    const st = await finalState(f)
    expect(['PUBLICADO', 'DESCARTADO']).toContain(st.vehicleStatus)
    expect(st.cambiosEstado).toBe(1)
  })

  it('rollback: si la traza falla, el vehículo revierte', async () => {
    const f = await seed('TASADO')
    // Actor inexistente → la FK de `Activity.agentId` falla DESPUÉS del CAS del vehículo.
    const err = await manualUpdate(
      f,
      'TASADO',
      'PUBLICADO',
      prismaA,
      {},
      'usuario-que-no-existe'
    ).catch((e) => e)

    expect(err).toBeInstanceOf(Error)
    expect(isVehicleStatusConflict(err)).toBe(false)
    const st = await finalState(f)
    expect(st.vehicleStatus).toBe('TASADO')
    expect(st.km).not.toBe(1234)
    expect(st.cambiosEstado).toBe(0)
  })
})

describe('edición manual vs dominio de ofertas', () => {
  it('descarte manual mientras se acepta una oferta: nunca queda ACEPTADA sin reserva', async () => {
    const f = await seed('PUBLICADO')

    // El dominio propietario acepta la oferta: el vehículo pasa a RESERVADO.
    const acceptRes = await acceptOffer(f, prismaA).catch((e) => e)
    expect(acceptRes).not.toBeInstanceOf(Error)

    // Con la oferta ya ACEPTADA (vehículo RESERVADO), la edición manual llega con estado obsoleto.
    const err = await manualUpdate(f, 'PUBLICADO', 'DESCARTADO', prismaB).catch((e) => e)

    expect(isVehicleStatusConflict(err)).toBe(true)
    const st = await finalState(f)
    expect(st.offerStatus).toBe('ACEPTADA')
    expect(st.vehicleStatus).toBe('RESERVADO')
    expect(st.aceptadaSinReserva).toBe(false)
    expect(st.km).not.toBe(1234)
  })

  it('edición manual bloqueada por el lock de la aceptación: espera y luego detecta el cambio', async () => {
    const f = await seed('PUBLICADO')

    // A retiene las raíces dentro de la aceptación.
    const roots = buildOfferTransitionRoots({
      vehicleId: f.vehicleId,
      sellerLeadId: f.sellerId,
      buyerLeadId: f.buyerId,
    })
    const locked = barrier()
    const release = barrier()

    const accept = withLockedRoots(
      roots,
      (tx) =>
        applyOfferTransitionTx(
          tx,
          {
            offerId: f.offerId,
            toStatus: 'ACEPTADA',
            resolvedVehicleId: f.vehicleId,
            resolvedBuyerLeadId: f.buyerId,
            resolvedSellerLeadId: f.sellerId,
            depositAmount: 1000,
            actorId: f.userId,
          },
          {
            beforeWrite: async () => {
              locked.open()
              await release.wait
            },
          }
        ),
      { client: prismaA, lockTimeoutMs: 8_000 }
    )
    await locked.wait

    // B intenta descartar el vehículo: la fila está bloqueada por A → espera de verdad.
    const manual = manualUpdate(f, 'PUBLICADO', 'DESCARTADO', prismaB).catch((e) => e)
    await waitUntilBlocked()

    release.open()
    await accept
    const manualRes = await manual

    // Al desbloquearse, el vehículo ya es RESERVADO → el CAS de la edición manual falla.
    expect(isVehicleStatusConflict(manualRes)).toBe(true)
    const st = await finalState(f)
    expect(st.vehicleStatus).toBe('RESERVADO')
    expect(st.offerStatus).toBe('ACEPTADA')
    expect(st.aceptadaSinReserva).toBe(false)
  })
})

describe('edición manual coordinada por raíces (I3B)', () => {
  it('publicación TASADO → PUBLICADO bajo el protocolo de raíces', async () => {
    const f = await seed('TASADO')

    const res = await coordinatedUpdate(f, 'PUBLICADO', prismaA)

    expect(res.statusChanged).toBe(true)
    const st = await finalState(f)
    expect(st.vehicleStatus).toBe('PUBLICADO')
    expect(st.km).toBe(1234)
    expect(st.cambiosEstado).toBe(1)
  })

  it('el vehículo cambió de vendedor entre resolución y relectura → VEHICLE_ROOT_CHANGED', async () => {
    const f = await seed('TASADO')
    // Otro vendedor toma el vehículo tras resolver las raíces con el original.
    const s2 = uniqueSuffix()
    const otro = await prismaA.sellerLead.create({
      data: { name: `S2 ${s2}`, email: `s2_${s2}@integ.test`, phone: '600000002' },
    })
    cleanups.push(async () => {
      await prismaA.sellerLead.deleteMany({ where: { id: otro.id } })
    })
    await prismaA.vehicle.update({ where: { id: f.vehicleId }, data: { sellerLeadId: otro.id } })

    const err = await coordinatedUpdate(f, 'PUBLICADO', prismaA, {
      resolvedSellerLeadId: f.sellerId,
    }).catch((e) => e)

    expect(isVehicleUpdateError(err) && err.code).toBe('VEHICLE_ROOT_CHANGED')
    const st = await finalState(f)
    expect(st.vehicleStatus).toBe('TASADO')
    expect(st.km).not.toBe(1234)
    expect(st.cambiosEstado).toBe(0)
  })

  it('vendedor archivado antes de publicar → LEAD_ARCHIVED, sin escribir', async () => {
    const f = await seed('TASADO')
    await prismaA.sellerLead.update({ where: { id: f.sellerId }, data: { archivedAt: new Date() } })

    const err = await coordinatedUpdate(f, 'PUBLICADO', prismaA).catch((e) => e)

    expect(isVehicleUpdateError(err) && err.code).toBe('LEAD_ARCHIVED')
    const st = await finalState(f)
    expect(st.vehicleStatus).toBe('TASADO')
    expect(st.cambiosEstado).toBe(0)
  })

  it('publicación vs creación de oferta: se serializan sobre el vehículo sin estado parcial', async () => {
    const f = await seed('TASADO')

    // Ambas son válidas sobre TASADO: publicar (TASADO→PUBLICADO) y crear una oferta (nace
    // PROPUESTA, no toca el estado). El lock del vehículo las serializa.
    const [pubRes] = await Promise.all([
      coordinatedUpdate(f, 'PUBLICADO', prismaA).catch((e) => e),
      prismaB.offer
        .create({
          data: {
            vehicleId: f.vehicleId,
            buyerLeadId: f.buyerId,
            amount: 30000,
            createdById: f.userId,
          },
        })
        .catch((e) => e),
    ])

    expect(pubRes).not.toBeInstanceOf(Error)
    const st = await finalState(f)
    expect(st.vehicleStatus).toBe('PUBLICADO')
    expect(st.cambiosEstado).toBe(1)
    // La oferta creada por B no depende del estado; el vehículo queda coherente en cualquier orden.
    const ofertas = await prismaA.offer.count({ where: { vehicleId: f.vehicleId } })
    expect(ofertas).toBeGreaterThanOrEqual(1)
  })

  it('publicación vs archivado del vendedor: nunca queda PUBLICADO con el vendedor archivado', async () => {
    const f = await seed('TASADO')

    const archiveLocked = barrier()
    const releaseArchive = barrier()

    // El archivado retiene las raíces (Vehicle → SellerLead) y se pausa antes de escribir.
    const archive = archiveSeller(f, prismaA, {
      beforeWrite: async () => {
        archiveLocked.open()
        await releaseArchive.wait
      },
    })
    await archiveLocked.wait

    // La publicación intenta las mismas raíces: espera al lock del vendedor.
    const publish = coordinatedUpdate(f, 'PUBLICADO', prismaB).catch((e) => e)
    await waitUntilBlocked()

    releaseArchive.open()
    await archive
    const publishRes = await publish

    // El archivado ganó: la publicación revalida y ve archivedAt ≠ null → LEAD_ARCHIVED.
    expect(isVehicleUpdateError(publishRes) && publishRes.code).toBe('LEAD_ARCHIVED')
    const seller = await prismaA.sellerLead.findUniqueOrThrow({ where: { id: f.sellerId } })
    const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })
    expect(seller.archivedAt).not.toBeNull()
    expect(vehicle.status).toBe('TASADO')
  })

  it('doble edición coordinada: A publica, B revalida sobre el estado nuevo y falla limpio', async () => {
    const f = await seed('TASADO')

    const aLocked = barrier()
    const releaseA = barrier()

    // A publica (TASADO → PUBLICADO) reteniendo las raíces, pausada antes del CAS.
    const a = coordinatedUpdate(f, 'PUBLICADO', prismaA, {
      hooks: {
        beforeCas: async () => {
          aLocked.open()
          await releaseA.wait
        },
      },
    }).catch((e) => e)
    await aLocked.wait

    // B quiere editar el vehículo creyéndolo TASADO (nextStatus = TASADO). Contiende por el lock.
    const b = coordinatedUpdate(f, 'TASADO', prismaB).catch((e) => e)
    await waitUntilBlocked()

    releaseA.open()
    const aRes = await a
    const bRes = await b

    // A gana; B, ya desbloqueado, relee PUBLICADO: su edición «como TASADO» (PUBLICADO → TASADO) ya
    // no es una transición válida → error de dominio, sin segunda escritura. La relectura dentro del
    // lock hace imposible el estado obsoleto: por eso B falla por transición, no por CAS.
    expect(aRes).not.toBeInstanceOf(Error)
    expect(isVehicleUpdateError(bRes) && bRes.code).toBe('INVALID_VEHICLE_TRANSITION')
    const st = await finalState(f)
    expect(st.vehicleStatus).toBe('PUBLICADO')
    expect(st.cambiosEstado).toBe(1)
  })

  it('lock timeout: no deja el vehículo a medias', async () => {
    const f = await seed('TASADO')

    const held = barrier()
    const release = barrier()

    // A retiene el lock del vehículo dentro de su transacción.
    const holder = archiveSeller(f, prismaA, {
      beforeWrite: async () => {
        held.open()
        await release.wait
      },
    })
    await held.wait

    // B pide el lock con un timeout muy corto → LockError, sin tocar el vehículo.
    const err = await coordinatedUpdate(f, 'PUBLICADO', prismaB, { lockTimeoutMs: 250 }).catch(
      (e) => e
    )
    expect(err).toBeInstanceOf(LockError)

    release.open()
    await holder
    const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })
    expect(vehicle.status).toBe('TASADO')
    expect(vehicle.km).not.toBe(1234)
  })

  it('rollback coordinado: si la traza falla, el vehículo revierte', async () => {
    const f = await seed('TASADO')

    // actorId inválido → la FK de Activity falla tras el CAS del vehículo.
    const err = await coordinatedUpdate(f, 'PUBLICADO', prismaA, {
      actorId: 'usuario-inexistente',
    }).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(isVehicleStatusConflict(err)).toBe(false)
    expect(isVehicleUpdateError(err)).toBe(false)
    const st = await finalState(f)
    expect(st.vehicleStatus).toBe('TASADO')
    expect(st.km).not.toBe(1234)
    expect(st.cambiosEstado).toBe(0)
  })
})
