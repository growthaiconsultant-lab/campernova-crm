/**
 * Tests de integración con PostgreSQL REAL (PR I3C3) — compleción COORDINADA de entrega.
 *
 * Demuestran que `completeDeliveryTx` bajo `withLockedRoots` (Vehicle → SellerLead → BuyerLead):
 *  - valida estado, checklist y firma BAJO el lock (cierra el TOCTOU que vivía fuera de la tx);
 *  - permite completar con leads archivados (sin reactivarlos);
 *  - detecta `DELIVERY_ROOT_CHANGED`;
 *  - mantiene atómicos Delivery→COMPLETADA, Vehicle→VENDIDO+soldAt, Match, Buyer, Warranty y
 *    follow-ups; y que la carrera con la cancelación y con otra compleción deja un único terminal.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient, DeliveryStatus } from '@prisma/client'
import { withLockedRoots } from '@/lib/locking'
import { buildDeliveryCreationRoots } from '@/lib/delivery-creation'
import {
  completeDeliveryTx,
  isDeliveryCompletionError,
  DeliveryConflictError,
  type CompleteDeliveryHooks,
} from '@/lib/delivery-completion'
import {
  transitionDeliveryTx,
  isDeliveryTransitionError,
  type TransitionDeliveryHooks,
} from '@/lib/delivery-transitions'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prismaA: PrismaClient
let prismaB: PrismaClient
let prismaObs: PrismaClient
const cleanups: Array<() => Promise<void>> = []

function barrier() {
  let open!: () => void
  const wait = new Promise<void>((r) => (open = r))
  return { wait, open }
}

async function waitUntilBlocked(timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const rows = await prismaObs.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'`
    if ((rows[0]?.n ?? 0) > 0) return
    if (Date.now() > deadline) throw new Error('contención no demostrada')
    await new Promise((r) => setTimeout(r, 25))
  }
}

type Fixture = {
  userId: string
  sellerId: string
  vehicleId: string
  buyerId: string
  offerId: string
  deliveryId: string
}

async function seed(
  opts: { pendingChecklist?: boolean; signed?: boolean; deliveryStatus?: DeliveryStatus } = {}
): Promise<Fixture> {
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
  const signed = opts.signed ?? true
  const delivery = await prismaA.delivery.create({
    data: {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      offerId: offer.id,
      responsableId: user.id,
      scheduledAt: new Date('2026-08-01T09:00:00Z'),
      status: opts.deliveryStatus ?? 'EN_CURSO',
      signedByName: signed ? 'Cliente' : null,
      signedByDni: signed ? '12345678Z' : null,
      signatureUrl: signed ? 'sig.png' : null,
      checklist: {
        create: [
          { category: 'PRE_ENTREGA', item: 'Doc', result: 'OK' },
          {
            category: 'PRE_ENTREGA',
            item: 'Llaves',
            result: opts.pendingChecklist ? 'PENDIENTE' : 'OK',
          },
        ],
      },
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

/** Compleción COORDINADA (production-accurate): withLockedRoots + completeDeliveryTx. */
function completeC(
  f: Fixture,
  client: PrismaClient,
  opts: { resolvedSellerLeadId?: string | null; hooks?: CompleteDeliveryHooks } = {}
) {
  const roots = buildDeliveryCreationRoots({
    vehicleId: f.vehicleId,
    sellerLeadId: f.sellerId,
    buyerLeadId: f.buyerId,
  })
  return withLockedRoots(
    roots,
    (tx) =>
      completeDeliveryTx(
        tx,
        {
          deliveryId: f.deliveryId,
          vehicleId: f.vehicleId,
          buyerLeadId: f.buyerId,
          resolvedSellerLeadId:
            opts.resolvedSellerLeadId === undefined ? f.sellerId : opts.resolvedSellerLeadId,
          actorId: f.userId,
          now: new Date('2026-08-02T10:00:00Z'),
        },
        opts.hooks
      ),
    { client, lockTimeoutMs: 8_000 }
  )
}

/** Cancelación COORDINADA (I3C2). */
function cancelC(f: Fixture, client: PrismaClient, hooks?: TransitionDeliveryHooks) {
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
          resolvedSellerLeadId: f.sellerId,
          expectedCurrentStatus: 'EN_CURSO',
          targetStatus: 'CANCELADA',
          actorId: f.userId,
          cancellationReason: 'incidencia',
          now: new Date('2026-08-02T10:00:00Z'),
        },
        hooks
      ),
    { client, lockTimeoutMs: 8_000 }
  )
}

const codeOf = (err: unknown): string | null =>
  isDeliveryCompletionError(err)
    ? err.code
    : isDeliveryTransitionError(err)
      ? err.code
      : err instanceof DeliveryConflictError
        ? err.reason
        : err instanceof Error
          ? 'OTHER'
          : null

async function state(f: Fixture) {
  const [d, v, o, warranties, followups, cancelActs] = await Promise.all([
    prismaA.delivery.findUniqueOrThrow({
      where: { id: f.deliveryId },
      select: { status: true, completedAt: true, cancellationReason: true },
    }),
    prismaA.vehicle.findUniqueOrThrow({
      where: { id: f.vehicleId },
      select: { status: true, soldAt: true },
    }),
    prismaA.offer.findUniqueOrThrow({ where: { id: f.offerId }, select: { status: true } }),
    prismaA.warranty.count({ where: { deliveryId: f.deliveryId } }),
    prismaA.postventaFollowup.count({ where: { warranty: { deliveryId: f.deliveryId } } }),
    prismaA.activity.count({ where: { buyerLeadId: f.buyerId, type: 'ENTREGA_CANCELADA' } }),
  ])
  return { d, v, o, warranties, followups, cancelActs }
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

describe('compleción coordinada · contrato', () => {
  it('camino feliz: COMPLETADA + VENDIDO + soldAt + Offer intacta + Warranty + 2 follow-ups', async () => {
    const f = await seed()
    await completeC(f, prismaA)
    const st = await state(f)
    expect(st.d.status).toBe('COMPLETADA')
    expect(st.d.completedAt).not.toBeNull()
    expect(st.v.status).toBe('VENDIDO')
    expect(st.v.soldAt).toEqual(st.d.completedAt) // mismo timestamp
    expect(st.o.status).toBe('CONVERTIDA') // Offer no cambia
    expect(st.warranties).toBe(1)
    expect(st.followups).toBe(2)
    const buyer = await prismaA.buyerLead.findUniqueOrThrow({
      where: { id: f.buyerId },
      select: { status: true },
    })
    expect(buyer.status).toBe('CERRADO')
  })

  it('CHECKLIST_INCOMPLETE bajo lock si hay un ítem PENDIENTE; nada muta', async () => {
    const f = await seed({ pendingChecklist: true })
    const err = await completeC(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe('CHECKLIST_INCOMPLETE')
    const st = await state(f)
    expect(st.d.status).toBe('EN_CURSO')
    expect(st.v.status).toBe('RESERVADO')
    expect(st.warranties).toBe(0)
  })

  it('SIGNATURE_REQUIRED si falta la firma', async () => {
    const f = await seed({ signed: false })
    expect(codeOf(await completeC(f, prismaA).catch((e) => e))).toBe('SIGNATURE_REQUIRED')
    expect((await state(f)).d.status).toBe('EN_CURSO')
  })

  it('DELIVERY_ROOT_CHANGED si el vendedor observado no coincide', async () => {
    const f = await seed()
    expect(
      codeOf(await completeC(f, prismaA, { resolvedSellerLeadId: 'stale' }).catch((e) => e))
    ).toBe('DELIVERY_ROOT_CHANGED')
    expect((await state(f)).d.status).toBe('EN_CURSO')
  })

  it('COMPLETADA repetida → DELIVERY_ALREADY_COMPLETED, una sola Warranty', async () => {
    const f = await seed()
    await completeC(f, prismaA)
    expect(codeOf(await completeC(f, prismaA).catch((e) => e))).toBe('DELIVERY_ALREADY_COMPLETED')
    expect((await state(f)).warranties).toBe(1)
  })
})

describe('compleción coordinada · leads archivados (permitido)', () => {
  it('BuyerLead archivado → completa; sigue archivado y pasa a CERRADO; no se reactiva', async () => {
    const f = await seed()
    const archivedAt = new Date('2026-07-01T00:00:00Z')
    await prismaA.buyerLead.update({ where: { id: f.buyerId }, data: { archivedAt } })
    await completeC(f, prismaA)
    const st = await state(f)
    expect(st.d.status).toBe('COMPLETADA')
    expect(st.v.status).toBe('VENDIDO')
    const buyer = await prismaA.buyerLead.findUniqueOrThrow({
      where: { id: f.buyerId },
      select: { status: true, archivedAt: true },
    })
    expect(buyer.status).toBe('CERRADO')
    expect(buyer.archivedAt).not.toBeNull() // NO reactivado
  })

  it('SellerLead archivado → completa; sigue archivado', async () => {
    const f = await seed()
    await prismaA.sellerLead.update({
      where: { id: f.sellerId },
      data: { archivedAt: new Date('2026-07-01T00:00:00Z') },
    })
    await completeC(f, prismaA)
    expect((await state(f)).d.status).toBe('COMPLETADA')
    const seller = await prismaA.sellerLead.findUniqueOrThrow({
      where: { id: f.sellerId },
      select: { archivedAt: true },
    })
    expect(seller.archivedAt).not.toBeNull()
  })
})

describe('compleción coordinada · concurrencia (contención observada)', () => {
  it('gana la COMPLECIÓN: la cancelación observa ALREADY_COMPLETED; COMPLETADA + VENDIDO + Warranty', async () => {
    const f = await seed()
    const paused = barrier()
    const release = barrier()
    // Compleción retiene los root locks tras sus CAS (pausa antes de la garantía).
    const completion = completeC(f, prismaB, {
      hooks: {
        beforeWarrantyWrite: async () => {
          paused.open()
          await release.wait
        },
      },
    }).catch((e) => e)
    await paused.wait
    const cancel = cancelC(f, prismaA).catch((e) => e)
    await waitUntilBlocked() // la cancelación bloquea esperando el vehículo
    release.open()
    const compRes = await completion
    const cancelRes = await cancel
    expect(compRes).not.toBeInstanceOf(Error)
    expect(codeOf(cancelRes)).toBe('DELIVERY_ALREADY_COMPLETED')
    const st = await state(f)
    expect(st.d.status).toBe('COMPLETADA')
    expect(st.d.cancellationReason).toBeNull()
    expect(st.v.status).toBe('VENDIDO')
    expect(st.warranties).toBe(1)
    expect(st.cancelActs).toBe(0)
  })

  it('gana la CANCELACIÓN: la compleción observa ALREADY_CANCELLED; Vehicle no vendido, sin Warranty', async () => {
    const f = await seed()
    const paused = barrier()
    const release = barrier()
    // La cancelación retiene los root locks tras su relectura (pausa antes de su CAS).
    const cancel = cancelC(f, prismaB, {
      beforeWrite: async () => {
        paused.open()
        await release.wait
      },
    }).catch((e) => e)
    await paused.wait
    const completion = completeC(f, prismaA).catch((e) => e)
    await waitUntilBlocked()
    release.open()
    const cancelRes = await cancel
    const compRes = await completion
    expect(cancelRes).not.toBeInstanceOf(Error)
    expect(codeOf(compRes)).toBe('DELIVERY_ALREADY_CANCELLED')
    const st = await state(f)
    expect(st.d.status).toBe('CANCELADA')
    expect(st.v.status).toBe('RESERVADO')
    expect(st.v.soldAt).toBeNull()
    expect(st.warranties).toBe(0)
  })

  it('dos compleciones concurrentes: una gana, una sola Warranty', async () => {
    const f = await seed()
    const paused = barrier()
    const release = barrier()
    const a = completeC(f, prismaB, {
      hooks: {
        beforeWarrantyWrite: async () => {
          paused.open()
          await release.wait
        },
      },
    }).catch((e) => e)
    await paused.wait
    const b = completeC(f, prismaA).catch((e) => e)
    await waitUntilBlocked()
    release.open()
    const aRes = await a
    const bRes = await b
    expect(aRes).not.toBeInstanceOf(Error)
    expect(codeOf(bRes)).toBe('DELIVERY_ALREADY_COMPLETED')
    expect((await state(f)).warranties).toBe(1)
  })
})
