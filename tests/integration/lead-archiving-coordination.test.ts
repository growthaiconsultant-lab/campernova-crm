/**
 * Integración PostgreSQL REAL — coordinación del archivado con el protocolo de root locks.
 *
 * Tras la corrección de PR #117, `archiveBuyerLead`/`archiveSellerLead` (y sus reactivaciones)
 * entran en `withLockedRoots` sobre la fila del lead. Estas pruebas demuestran, con dos conexiones
 * y contención observada (`waitUntilBlocked`), que archivar se **serializa** con los writers
 * coordinados reales (`createOfferTx`, `createDeliveryTx`):
 *   - si el writer gana, el archivado se bloquea, relee sus dependencias BAJO el lock y **rechaza**
 *     (`blocked`) → nunca queda "archivado + operativa activa";
 *   - si el archivado gana, el writer relee `archivedAt` bajo su propio lock y **rechaza**
 *     (`LEAD_ARCHIVED`) → nunca crea operativa para un lead archivado.
 *
 * La compleción/cancelación de una Delivery ya `EN_CURSO` con lead archivado (que DEBE poder
 * terminar, conservando `archivedAt`) está cubierta en `delivery-completion-coordination.test.ts`
 * y `delivery-transition.test.ts`; no se duplica aquí.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import type { PrismaClient, User } from '@prisma/client'

vi.mock('next/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/cache')>()
  return { ...actual, revalidatePath: vi.fn() }
})

const { authHolder } = vi.hoisted(() => ({ authHolder: { user: null as unknown as User } }))
vi.mock('@/lib/auth', () => ({
  requireAgente: async () => authHolder.user,
  requireAdmin: async () => authHolder.user,
}))

// La server action de archivado usa el singleton `@/lib/db` → prismaA.
vi.mock('@/lib/db', async () => {
  const { createGuardedTestPrisma } = await import('./db')
  return { db: createGuardedTestPrisma() }
})

import { db } from '@/lib/db'
import { createGuardedTestPrisma, uniqueSuffix } from './db'
import { archiveBuyerLead, reactivateBuyerLead } from '@/app/(backoffice)/lead-archiving-actions'
import { withLockedRoots } from '@/lib/locking'
import { createOfferTx, buildOfferCreationRoots, isOfferCreationError } from '@/lib/offers-creation'
import {
  createDeliveryTx,
  buildDeliveryCreationRoots,
  isDeliveryCreationError,
} from '@/lib/delivery-creation'

const prismaA = db as PrismaClient // conexión del archivado (singleton mockeado)
let prismaB: PrismaClient // conexión del writer coordinado
let prismaObs: PrismaClient // observador de contención
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

type Fx = {
  sellerId: string
  vehicleId: string
  buyerId: string
  offerId: string
}

async function seed(vehicleStatus: 'PUBLICADO' | 'RESERVADO'): Promise<Fx> {
  const s = uniqueSuffix()
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
    data: {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      amount: 25_000,
      status: 'CONVERTIDA',
      createdById: authHolder.user.id,
    },
  })
  cleanups.push(async () => {
    await prismaA.activity.deleteMany({
      where: { OR: [{ sellerLeadId: seller.id }, { buyerLeadId: buyer.id }] },
    })
    await prismaA.deliveryChecklistItem.deleteMany({
      where: { delivery: { vehicleId: vehicle.id } },
    })
    await prismaA.delivery.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.offer.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prismaA.buyerLead.deleteMany({ where: { id: buyer.id } })
    await prismaA.sellerLead.deleteMany({ where: { id: seller.id } })
  })
  return { sellerId: seller.id, vehicleId: vehicle.id, buyerId: buyer.id, offerId: offer.id }
}

/** createOffer COORDINADO en prismaB, con hook opcional para retener el lock. */
function createOfferC(f: Fx, hooks?: { beforeOfferWrite?: () => Promise<void> }) {
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
          amount: 20_000,
          notes: null,
          actorId: authHolder.user.id,
        },
        hooks
      ),
    { client: prismaB, lockTimeoutMs: 8_000 }
  )
}

/** createDelivery COORDINADO en prismaB, con hook opcional para retener el lock. */
function createDeliveryC(f: Fx, hooks?: { beforeWrite?: () => Promise<void> }) {
  const roots = buildDeliveryCreationRoots({
    vehicleId: f.vehicleId,
    sellerLeadId: f.sellerId,
    buyerLeadId: f.buyerId,
  })
  return withLockedRoots(
    roots,
    (tx) =>
      createDeliveryTx(
        tx,
        {
          vehicleId: f.vehicleId,
          buyerLeadId: f.buyerId,
          offerId: f.offerId,
          resolvedSellerLeadId: f.sellerId,
          scheduledAt: new Date('2026-09-01T10:00:00Z'),
          responsableId: null,
          notes: null,
          actorId: authHolder.user.id,
          checklist: [{ category: 'PRE_ENTREGA', item: 'Documentación' }],
        },
        hooks
      ),
    { client: prismaB, lockTimeoutMs: 8_000 }
  )
}

const codeOf = (e: unknown): string | null =>
  isOfferCreationError(e) || isDeliveryCreationError(e)
    ? e.code
    : e instanceof Error
      ? 'OTHER'
      : null

async function buyerArchived(buyerId: string): Promise<boolean> {
  const b = await prismaA.buyerLead.findUniqueOrThrow({
    where: { id: buyerId },
    select: { archivedAt: true },
  })
  return b.archivedAt != null
}

beforeAll(async () => {
  prismaB = createGuardedTestPrisma()
  prismaObs = createGuardedTestPrisma()
  const s = uniqueSuffix()
  authHolder.user = await prismaA.user.create({
    data: { email: `arch_coord_${s}@integ.test`, name: `Agente ${s}`, role: 'AGENTE' },
  })
})
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!()
})
afterAll(async () => {
  await prismaA.user.deleteMany({ where: { id: authHolder.user.id } })
  await Promise.all([prismaB.$disconnect(), prismaObs.$disconnect()])
})

describe('archivar comprador vs createOffer (serializados por el lock del lead)', () => {
  it('gana el WRITER: el archivado se bloquea y luego observa la oferta viva → blocked', async () => {
    const f = await seed('PUBLICADO')
    const paused = barrier()
    const release = barrier()
    const offer = createOfferC(f, {
      beforeOfferWrite: async () => {
        paused.open()
        await release.wait
      },
    }).catch((e) => e)
    await paused.wait
    const arch = archiveBuyerLead(f.buyerId, 'OTRO').catch((e) => e)
    await waitUntilBlocked()
    release.open()
    const offerRes = await offer
    const archRes = await arch
    expect(offerRes).not.toBeInstanceOf(Error) // la oferta se creó
    expect(archRes.status).toBe('blocked') // el archivado la vio bajo el lock
    expect(await buyerArchived(f.buyerId)).toBe(false)
  })

  it('gana el ARCHIVADO: createOffer relee archivedAt y rechaza LEAD_ARCHIVED', async () => {
    const f = await seed('PUBLICADO')
    const archRes = await archiveBuyerLead(f.buyerId, 'OTRO')
    expect(archRes.status).toBe('archived')
    const offerRes = await createOfferC(f).catch((e) => e)
    expect(codeOf(offerRes)).toBe('LEAD_ARCHIVED')
    const offers = await prismaA.offer.count({
      where: { buyerLeadId: f.buyerId, status: { not: 'CONVERTIDA' } },
    })
    expect(offers).toBe(0)
  })
})

describe('archivar comprador vs createDelivery (serializados por el lock del lead)', () => {
  it('gana el WRITER: el archivado se bloquea y luego observa la entrega activa → blocked', async () => {
    const f = await seed('RESERVADO')
    const paused = barrier()
    const release = barrier()
    const del = createDeliveryC(f, {
      beforeWrite: async () => {
        paused.open()
        await release.wait
      },
    }).catch((e) => e)
    await paused.wait
    const arch = archiveBuyerLead(f.buyerId, 'OTRO').catch((e) => e)
    await waitUntilBlocked()
    release.open()
    const delRes = await del
    const archRes = await arch
    expect(delRes).not.toBeInstanceOf(Error)
    expect(archRes.status).toBe('blocked')
    expect(await buyerArchived(f.buyerId)).toBe(false)
  })

  it('gana el ARCHIVADO: createDelivery relee archivedAt y rechaza LEAD_ARCHIVED', async () => {
    const f = await seed('RESERVADO')
    const archRes = await archiveBuyerLead(f.buyerId, 'OTRO')
    expect(archRes.status).toBe('archived')
    const delRes = await createDeliveryC(f).catch((e) => e)
    expect(codeOf(delRes)).toBe('LEAD_ARCHIVED')
    expect(await prismaA.delivery.count({ where: { buyerLeadId: f.buyerId } })).toBe(0)
  })
})

describe('archivar vs reactivar (mismo lead, deterministas)', () => {
  it('archivar + reactivar concurrentes convergen sin estado roto', async () => {
    const f = await seed('RESERVADO')
    // Punto de partida activo → archivar y reactivar compiten; el lock los serializa.
    const [a, b] = await Promise.all([
      archiveBuyerLead(f.buyerId, 'OTRO'),
      reactivateBuyerLead(f.buyerId),
    ])
    const statuses = [a.status, b.status].sort()
    // O bien reactivar corre primero (ya activo) y archivar gana, o archivar corre primero y
    // reactivar lo deshace. En ambos casos el estado final es coherente con las Activities.
    const archivedNow = await buyerArchived(f.buyerId)
    const archivedActs = await prismaA.activity.count({
      where: { buyerLeadId: f.buyerId, type: 'LEAD_ARCHIVADO' },
    })
    const reactivatedActs = await prismaA.activity.count({
      where: { buyerLeadId: f.buyerId, type: 'LEAD_REACTIVADO' },
    })
    // Nunca hay estado roto: como máximo una Activity de cada tipo, y coherencia archivedAt↔trazas.
    expect(archivedActs).toBeLessThanOrEqual(1)
    expect(reactivatedActs).toBeLessThanOrEqual(1)
    expect(statuses.length).toBe(2)
    if (archivedNow) {
      // terminó archivado ⇒ hubo exactamente un archivado y no un reactivado posterior efectivo
      expect(archivedActs).toBe(1)
    }
  })
})
