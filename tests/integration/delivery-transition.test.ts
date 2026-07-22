/**
 * Tests de integración con PostgreSQL REAL (PR I3C2) — transiciones y cancelación coordinadas.
 *
 * Demuestran, sobre una base efímera migrada, que PROGRAMADA→EN_CURSO y *→CANCELADA ocurren bajo
 * `withLockedRoots` (Vehicle → SellerLead → BuyerLead) con compare-and-swap y Activity atómica; que
 * la cancelación NO libera el vehículo ni modifica la Offer; y que la carrera cancelación↔compleción
 * (que todavía NO usa locks, I3C3) nunca deja un estado incoherente: gane quien gane, hay un único
 * estado terminal y el perdedor revierte por completo.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient, DeliveryStatus } from '@prisma/client'
import { withLockedRoots } from '@/lib/locking'
import { buildDeliveryCreationRoots } from '@/lib/delivery-creation'
import {
  transitionDeliveryTx,
  isDeliveryTransitionError,
  type DeliveryTransitionSource,
  type DeliveryTransitionTarget,
  type TransitionDeliveryHooks,
} from '@/lib/delivery-transitions'
import {
  completeDeliveryTx,
  DeliveryConflictError,
  type CompleteDeliveryHooks,
} from '@/lib/delivery-completion'
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
  offerId: string
  deliveryId: string
}

async function seed(deliveryStatus: DeliveryStatus = 'PROGRAMADA'): Promise<Fixture> {
  const s = uniqueSuffix()
  const user = await prismaA.user.create({
    data: { name: `U ${s}`, email: `u_${s}@integ.test`, role: 'ENTREGAS' },
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
      status: 'RESERVADO',
    },
  })
  const buyer = await prismaA.buyerLead.create({
    data: { name: `B ${s}`, email: `b_${s}@integ.test`, phone: '600000001' },
  })
  const offer = await prismaA.offer.create({
    data: {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      amount: 25000,
      createdById: user.id,
      status: 'CONVERTIDA',
    },
  })
  const delivery = await prismaA.delivery.create({
    data: {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      offerId: offer.id,
      responsableId: user.id,
      scheduledAt: new Date('2026-08-01T09:00:00Z'),
      status: deliveryStatus,
      signedByName: 'Cliente',
      signedByDni: '12345678Z',
      signatureUrl: 'sig.png',
    },
  })

  cleanups.push(async () => {
    await prismaA.postventaFollowup.deleteMany({ where: { warranty: { deliveryId: delivery.id } } })
    await prismaA.warranty.deleteMany({ where: { deliveryId: delivery.id } })
    await prismaA.activity.deleteMany({
      where: { OR: [{ sellerLeadId: seller.id }, { buyerLeadId: buyer.id }] },
    })
    await prismaA.deliveryChecklistItem.deleteMany({ where: { deliveryId: delivery.id } })
    await prismaA.delivery.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.offer.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prismaA.buyerLead.deleteMany({ where: { id: buyer.id } })
    await prismaA.sellerLead.deleteMany({ where: { id: seller.id } })
    await prismaA.user.deleteMany({ where: { id: user.id } })
  })

  return {
    userId: user.id,
    sellerId: seller.id,
    vehicleId: vehicle.id,
    buyerId: buyer.id,
    offerId: offer.id,
    deliveryId: delivery.id,
  }
}

function transition(
  f: Fixture,
  client: PrismaClient,
  opts: {
    expected: DeliveryTransitionSource
    target: DeliveryTransitionTarget
    reason?: string | null
    resolvedSellerLeadId?: string | null
    hooks?: TransitionDeliveryHooks
  }
) {
  // Las raíces se bloquean siempre sobre el vendedor REAL (existe → FOR UPDATE OK). El parámetro
  // `resolvedSellerLeadId` del núcleo se controla aparte para simular un cambio de raíz.
  const roots = buildDeliveryCreationRoots({
    vehicleId: f.vehicleId,
    sellerLeadId: f.sellerId,
    buyerLeadId: f.buyerId,
  })
  return withLockedRoots(
    roots,
    (tx) =>
      transitionDeliveryTx(
        tx,
        {
          deliveryId: f.deliveryId,
          vehicleId: f.vehicleId,
          buyerLeadId: f.buyerId,
          resolvedSellerLeadId:
            opts.resolvedSellerLeadId === undefined ? f.sellerId : opts.resolvedSellerLeadId,
          expectedCurrentStatus: opts.expected,
          targetStatus: opts.target,
          actorId: f.userId,
          cancellationReason: opts.reason ?? null,
          now: new Date('2026-08-02T10:00:00Z'),
        },
        opts.hooks
      ),
    { client, lockTimeoutMs: 8_000 }
  )
}

function complete(f: Fixture, client: PrismaClient, hooks: CompleteDeliveryHooks = {}) {
  return client.$transaction(
    (tx) =>
      completeDeliveryTx(
        tx,
        {
          deliveryId: f.deliveryId,
          vehicleId: f.vehicleId,
          buyerLeadId: f.buyerId,
          sellerLeadId: f.sellerId,
          actorId: f.userId,
          now: new Date('2026-08-02T10:00:00Z'),
        },
        hooks
      ),
    { timeout: 20_000, maxWait: 15_000 }
  )
}

const codeOf = (err: unknown) => (isDeliveryTransitionError(err) ? err.code : null)

async function state(f: Fixture) {
  const [d, v, o, warranties, cancelActs] = await Promise.all([
    prismaA.delivery.findUniqueOrThrow({
      where: { id: f.deliveryId },
      select: { status: true, startedAt: true, cancellationReason: true },
    }),
    prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId }, select: { status: true } }),
    prismaA.offer.findUniqueOrThrow({ where: { id: f.offerId }, select: { status: true } }),
    prismaA.warranty.count({ where: { deliveryId: f.deliveryId } }),
    prismaA.activity.count({ where: { buyerLeadId: f.buyerId, type: 'ENTREGA_CANCELADA' } }),
  ])
  return { d, v, o, warranties, cancelActs }
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

describe('transiciones coordinadas', () => {
  it('PROGRAMADA → EN_CURSO: status EN_CURSO + startedAt + Activity; Offer/Vehicle intactos', async () => {
    const f = await seed('PROGRAMADA')
    const res = await transition(f, prismaA, { expected: 'PROGRAMADA', target: 'EN_CURSO' })
    expect(res).toEqual({ previousStatus: 'PROGRAMADA', newStatus: 'EN_CURSO' })
    const st = await state(f)
    expect(st.d.status).toBe('EN_CURSO')
    expect(st.d.startedAt).not.toBeNull()
    expect(st.v.status).toBe('RESERVADO')
    expect(st.o.status).toBe('CONVERTIDA')
  })

  it('PROGRAMADA → CANCELADA: motivo atómico + Activity; NO libera Vehicle ni toca Offer', async () => {
    const f = await seed('PROGRAMADA')
    await transition(f, prismaA, { expected: 'PROGRAMADA', target: 'CANCELADA', reason: 'aplaza' })
    const st = await state(f)
    expect(st.d.status).toBe('CANCELADA')
    expect(st.d.cancellationReason).toBe('aplaza')
    expect(st.v.status).toBe('RESERVADO') // no se libera
    expect(st.o.status).toBe('CONVERTIDA') // no se toca
    expect(st.cancelActs).toBe(1)
  })

  it('EN_CURSO → CANCELADA permitido', async () => {
    const f = await seed('EN_CURSO')
    await transition(f, prismaA, { expected: 'EN_CURSO', target: 'CANCELADA', reason: 'motivo' })
    expect((await state(f)).d.status).toBe('CANCELADA')
  })

  it('cancelación repetida: la 2ª falla ALREADY_CANCELLED y no crea otra Activity', async () => {
    const f = await seed('PROGRAMADA')
    await transition(f, prismaA, { expected: 'PROGRAMADA', target: 'CANCELADA', reason: 'r1' })
    const err = await transition(f, prismaA, {
      expected: 'PROGRAMADA',
      target: 'CANCELADA',
      reason: 'r2',
    }).catch((e) => e)
    expect(codeOf(err)).toBe('DELIVERY_ALREADY_CANCELLED')
    expect((await state(f)).cancelActs).toBe(1)
  })

  it('una entrega COMPLETADA no es cancelable (ALREADY_COMPLETED)', async () => {
    const f = await seed('EN_CURSO')
    await complete(f, prismaA)
    const err = await transition(f, prismaA, {
      expected: 'EN_CURSO',
      target: 'CANCELADA',
      reason: 'x',
    }).catch((e) => e)
    expect(codeOf(err)).toBe('DELIVERY_ALREADY_COMPLETED')
    const st = await state(f)
    expect(st.d.status).toBe('COMPLETADA')
    expect(st.v.status).toBe('VENDIDO')
  })

  it('DELIVERY_ROOT_CHANGED si el vendedor observado no coincide', async () => {
    const f = await seed('PROGRAMADA')
    const err = await transition(f, prismaA, {
      expected: 'PROGRAMADA',
      target: 'EN_CURSO',
      resolvedSellerLeadId: 'inexistente',
    }).catch((e) => e)
    expect(codeOf(err)).toBe('DELIVERY_ROOT_CHANGED')
  })

  it('permite recrear una Delivery tras CANCELADA (Vehicle sigue RESERVADO)', async () => {
    const f = await seed('PROGRAMADA')
    await transition(f, prismaA, { expected: 'PROGRAMADA', target: 'CANCELADA', reason: 'r' })
    // Sin Delivery activa ni completada, el índice parcial permite otra activa.
    const nueva = await prismaA.delivery.create({
      data: {
        vehicleId: f.vehicleId,
        buyerLeadId: f.buyerId,
        offerId: f.offerId,
        scheduledAt: new Date('2026-09-01T09:00:00Z'),
        status: 'PROGRAMADA',
      },
    })
    expect(nueva.id).toBeTruthy()
    await prismaA.delivery.deleteMany({ where: { id: nueva.id } })
  })
})

describe('concurrencia cancelación ↔ compleción (ambas intercalaciones)', () => {
  it('gana la CANCELACIÓN: la compleción falla y revierte; Vehicle NO vendido, sin Warranty', async () => {
    const f = await seed('EN_CURSO')
    const paused = barrier()
    const release = barrier()
    // Compleción pausada ANTES de su CAS (todavía no bloquea la fila).
    const completion = complete(f, prismaB, {
      beforeDeliveryWrite: async () => {
        paused.open()
        await release.wait
      },
    }).catch((e) => e)
    await paused.wait
    // La cancelación corre entera y confirma CANCELADA.
    await transition(f, prismaA, {
      expected: 'EN_CURSO',
      target: 'CANCELADA',
      reason: 'gana cancel',
    })
    release.open()
    const compRes = await completion
    expect(compRes).toBeInstanceOf(DeliveryConflictError)
    const st = await state(f)
    expect(st.d.status).toBe('CANCELADA')
    expect(st.v.status).toBe('RESERVADO')
    expect(st.warranties).toBe(0)
  })

  it('gana la COMPLECIÓN: la cancelación observa ALREADY_COMPLETED; COMPLETADA + VENDIDO + Warranty', async () => {
    const f = await seed('EN_CURSO')
    const paused = barrier()
    const release = barrier()
    // Compleción pausada DESPUÉS de sus CAS (entrega→COMPLETADA, vehículo→VENDIDO), reteniendo los
    // row-locks de esas filas dentro de su transacción, antes de crear la garantía.
    const completion = complete(f, prismaB, {
      beforeWarrantyWrite: async () => {
        paused.open()
        await release.wait
      },
    }).catch((e) => e)
    await paused.wait
    // La cancelación arranca: `withLockedRoots` pide FOR UPDATE del vehículo → BLOQUEA (lo retiene la
    // compleción sin commitear). No hay deadlock: la compleción no espera a la cancelación.
    const cancel = transition(f, prismaA, {
      expected: 'EN_CURSO',
      target: 'CANCELADA',
      reason: 'pierde',
    }).catch((e) => e)
    release.open()
    const compRes = await completion
    const cancelRes = await cancel
    expect(compRes).not.toBeInstanceOf(Error) // la compleción confirma
    expect(codeOf(cancelRes)).toBe('DELIVERY_ALREADY_COMPLETED')
    const st = await state(f)
    expect(st.d.status).toBe('COMPLETADA')
    expect(st.d.cancellationReason).toBeNull()
    expect(st.v.status).toBe('VENDIDO')
    expect(st.warranties).toBe(1)
    expect(st.cancelActs).toBe(0)
  })

  it('dos cancelaciones concurrentes: exactamente una gana, una Activity', async () => {
    const f = await seed('PROGRAMADA')
    const aLocked = barrier()
    const releaseA = barrier()
    const a = transition(f, prismaA, {
      expected: 'PROGRAMADA',
      target: 'CANCELADA',
      reason: 'A',
      hooks: {
        beforeWrite: async () => {
          aLocked.open()
          await releaseA.wait
        },
      },
    }).catch((e) => e)
    await aLocked.wait
    // B espera el lock de raíz que tiene A; se libera A y B relee → ALREADY_CANCELLED.
    const b = transition(f, prismaB, {
      expected: 'PROGRAMADA',
      target: 'CANCELADA',
      reason: 'B',
    }).catch((e) => e)
    releaseA.open()
    const aRes = await a
    const bRes = await b
    expect(aRes).not.toBeInstanceOf(Error)
    expect(codeOf(bRes)).toBe('DELIVERY_ALREADY_CANCELLED')
    expect((await state(f)).cancelActs).toBe(1)
  })
})
