/**
 * Tests de integración con PostgreSQL REAL (PUB-1) — despublicación de un anuncio.
 *
 * Demuestran:
 *   · despublicar PUBLICADO → TASADO bajo lock/CAS, traza PUBLICACION_RETIRADA, conservando publishedAt;
 *   · guard de ofertas activas BAJO EL LOCK: no se retira con una oferta viva (PROPUESTA);
 *   · rechazo si el vehículo no está PUBLICADO;
 *   · dos despublicaciones concurrentes → una gana (TASADO), la otra ve NOT_PUBLISHED, una sola traza;
 *   · publicar fija publishedAt (primera vez) y republicar tras despublicar lo CONSERVA.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { withLockedRoots } from '@/lib/locking'
import { buildVehicleUpdateRoots, applyManualVehicleUpdateTx } from '@/lib/vehicle-status'
import {
  unpublishVehicleTx,
  isUnpublishError,
  type UnpublishVehicleHooks,
} from '@/lib/vehicle-unpublish'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prismaA: PrismaClient
let prismaB: PrismaClient
let prismaObs: PrismaClient
const cleanups: Array<() => Promise<void>> = []

async function waitUntilBlocked(timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const rows = await prismaObs.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'`
    if ((rows[0]?.n ?? 0) > 0) return
    if (Date.now() > deadline) throw new Error('la otra operación nunca esperó un lock')
    await new Promise((r) => setTimeout(r, 25))
  }
}

type Fixture = { userId: string; sellerId: string; vehicleId: string }

async function seed(
  opts: {
    status?: 'PUBLICADO' | 'TASADO'
    publishedAt?: Date | null
    withActiveOffer?: boolean
  } = {}
): Promise<Fixture> {
  const status = opts.status ?? 'PUBLICADO'
  const publishedAt =
    opts.publishedAt === undefined ? new Date('2026-03-01T10:00:00Z') : opts.publishedAt
  const s = uniqueSuffix()
  const user = await prismaA.user.create({
    data: { name: `U ${s}`, email: `u_${s}@integ.test`, role: 'AGENTE' },
  })
  const seller = await prismaA.sellerLead.create({
    data: { name: `S ${s}`, email: `s_${s}@integ.test`, phone: '600000000', agentId: user.id },
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
      status,
      publishedAt,
    },
  })
  let buyerId: string | null = null
  if (opts.withActiveOffer) {
    const buyer = await prismaA.buyerLead.create({
      data: { name: `B ${s}`, email: `b_${s}@integ.test`, phone: '600111222' },
    })
    buyerId = buyer.id
    await prismaA.offer.create({
      data: {
        vehicleId: vehicle.id,
        buyerLeadId: buyer.id,
        amount: 20000,
        status: 'PROPUESTA',
        createdById: user.id,
      },
    })
  }

  cleanups.push(async () => {
    await prismaA.activity.deleteMany({ where: { sellerLeadId: seller.id } })
    await prismaA.offer.deleteMany({ where: { vehicleId: vehicle.id } })
    if (buyerId) await prismaA.buyerLead.deleteMany({ where: { id: buyerId } })
    await prismaA.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prismaA.sellerLead.deleteMany({ where: { id: seller.id } })
    await prismaA.user.deleteMany({ where: { id: user.id } })
  })
  return { userId: user.id, sellerId: seller.id, vehicleId: vehicle.id }
}

function unpublish(
  f: Fixture,
  client: PrismaClient,
  opts: { reason?: string | null; hooks?: UnpublishVehicleHooks } = {}
) {
  const roots = buildVehicleUpdateRoots({ vehicleId: f.vehicleId, sellerLeadId: f.sellerId })
  return withLockedRoots(
    roots,
    (tx) =>
      unpublishVehicleTx(
        tx,
        {
          vehicleId: f.vehicleId,
          resolvedSellerLeadId: f.sellerId,
          actorId: f.userId,
          reason: opts.reason ?? null,
        },
        opts.hooks
      ),
    { client }
  )
}

function publish(f: Fixture) {
  const roots = buildVehicleUpdateRoots({ vehicleId: f.vehicleId, sellerLeadId: f.sellerId })
  return withLockedRoots(
    roots,
    (tx) =>
      applyManualVehicleUpdateTx(tx, {
        vehicleId: f.vehicleId,
        resolvedSellerLeadId: f.sellerId,
        nextStatus: 'PUBLICADO',
        data: { status: 'PUBLICADO' },
        actorId: f.userId,
        activityContent: () => 'Publicado',
      }),
    { client: prismaA }
  )
}

const codeOf = (e: unknown) => (isUnpublishError(e) ? e.code : e instanceof Error ? e.name : null)

async function vehicleState(vehicleId: string) {
  return prismaA.vehicle.findUniqueOrThrow({
    where: { id: vehicleId },
    select: { status: true, publishedAt: true },
  })
}
const retiradaCount = (sellerId: string) =>
  prismaA.activity.count({ where: { sellerLeadId: sellerId, type: 'PUBLICACION_RETIRADA' } })

beforeAll(() => {
  prismaA = createGuardedTestPrisma()
  prismaB = createGuardedTestPrisma()
  prismaObs = createGuardedTestPrisma()
})

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!()
})

describe('unpublishVehicleTx · camino feliz', () => {
  it('PUBLICADO → TASADO, traza PUBLICACION_RETIRADA, publishedAt conservado', async () => {
    const publishedAt = new Date('2026-03-01T10:00:00Z')
    const f = await seed({ publishedAt })
    const res = await unpublish(f, prismaA, { reason: 'vendido fuera' })
    expect(res.vehicleId).toBe(f.vehicleId)

    const st = await vehicleState(f.vehicleId)
    expect(st.status).toBe('TASADO')
    expect(st.publishedAt?.getTime()).toBe(publishedAt.getTime())
    expect(await retiradaCount(f.sellerId)).toBe(1)
  })
})

describe('unpublishVehicleTx · guards', () => {
  it('bloquea con oferta activa (PROPUESTA) y no cambia el estado', async () => {
    const f = await seed({ withActiveOffer: true })
    const err = await unpublish(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe('ACTIVE_OFFERS')
    expect((await vehicleState(f.vehicleId)).status).toBe('PUBLICADO')
    expect(await retiradaCount(f.sellerId)).toBe(0)
  })

  it('rechaza si el vehículo no está publicado', async () => {
    const f = await seed({ status: 'TASADO', publishedAt: null })
    const err = await unpublish(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe('NOT_PUBLISHED')
  })
})

describe('unpublishVehicleTx · concurrencia', () => {
  it('dos despublicaciones concurrentes → una gana, la otra NOT_PUBLISHED, una sola traza', async () => {
    const f = await seed()
    // A adquiere el lock y espera dentro (beforeWrite) a que B quede bloqueada en el mismo lock.
    const pA = unpublish(f, prismaA, {
      hooks: { beforeWrite: async () => void (await waitUntilBlocked()) },
    })
    const pB = unpublish(f, prismaB)
    const [rA, rB] = await Promise.allSettled([pA, pB])

    const ok = [rA, rB].filter((r) => r.status === 'fulfilled')
    const ko = [rA, rB].filter((r) => r.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(ko).toHaveLength(1)
    expect(codeOf((ko[0] as PromiseRejectedResult).reason)).toBe('NOT_PUBLISHED')

    expect((await vehicleState(f.vehicleId)).status).toBe('TASADO')
    expect(await retiradaCount(f.sellerId)).toBe(1)
  })
})

describe('publishedAt · primera publicación + republicación', () => {
  it('publicar fija publishedAt; republicar tras despublicar lo conserva', async () => {
    const f = await seed({ status: 'TASADO', publishedAt: null })
    await publish(f)
    const first = (await vehicleState(f.vehicleId)).publishedAt
    expect(first).not.toBeNull()

    await unpublish(f, prismaA)
    expect((await vehicleState(f.vehicleId)).status).toBe('TASADO')

    await publish(f)
    const second = await vehicleState(f.vehicleId)
    expect(second.status).toBe('PUBLICADO')
    expect(second.publishedAt?.getTime()).toBe(first?.getTime()) // conservado
  })
})
