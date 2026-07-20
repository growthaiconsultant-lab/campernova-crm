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
  applyVehicleUpdateTx,
  isVehicleStatusConflict,
  type VehicleUpdateHooks,
} from '@/lib/vehicle-status'
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
