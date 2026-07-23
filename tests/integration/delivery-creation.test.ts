/**
 * Tests de integración con PostgreSQL REAL (PR I3C1A) — creación coordinada de Delivery,
 * `onDelete: NoAction` y el índice único parcial de Delivery activa.
 *
 * Demuestran:
 *   · createDeliveryTx exige Offer CONVERTIDA + Vehicle RESERVADO + unicidad, bajo locks;
 *   · el índice `deliveries_active_vehicle_key` rechaza dos Deliveries activas por vehículo;
 *   · la FK Delivery.offer_id es NO ACTION: borrar la Offer directamente falla, borrar el Vehicle
 *     padre elimina Offer y Delivery en cascada convergente;
 *   · tras el contract I3C1B (offer_id NOT NULL) un INSERT que omite offer_id es rechazado.
 *
 * Barreras deterministas y varias conexiones; sin `sleep` como mecanismo de sincronización.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient, VehicleStatus, DeliveryStatus } from '@prisma/client'
import { withLockedRoots, LockError } from '@/lib/locking'
import {
  createDeliveryTx,
  buildDeliveryCreationRoots,
  isDeliveryCreationError,
  isPotentialActiveDeliveryVehicleConflict,
  ACTIVE_DELIVERY_UNIQUE_INDEX,
  type CreateDeliveryHooks,
} from '@/lib/delivery-creation'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prismaA: PrismaClient
let prismaB: PrismaClient
let prismaObs: PrismaClient
const cleanups: Array<() => Promise<void>> = []

function barrier() {
  let open!: () => void
  const wait = new Promise<void>((resolve) => {
    open = resolve
  })
  return { wait, open }
}

async function waitUntilBlocked(timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const rows = await prismaObs.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'`
    if ((rows[0]?.n ?? 0) > 0) return
    if (Date.now() > deadline) {
      throw new Error('la otra operación nunca llegó a esperar un lock: contención no demostrada')
    }
    await new Promise((r) => setTimeout(r, 25))
  }
}

const CHECKLIST = [{ category: 'PRE_ENTREGA' as const, item: 'Test' }]

type Fixture = {
  userId: string
  sellerId: string
  vehicleId: string
  buyerId: string
  offerId: string
}

/** Siembra Vehicle (estado parametrizable) + Offer (estado parametrizable) + leads. */
async function seed(
  vehicleStatus: VehicleStatus = 'RESERVADO',
  offerStatus: 'CONVERTIDA' | 'ACEPTADA' | 'PROPUESTA' = 'CONVERTIDA'
): Promise<Fixture> {
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
    data: {
      vehicleId: vehicle.id,
      buyerLeadId: buyer.id,
      amount: 25000,
      createdById: user.id,
      status: offerStatus,
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

function create(
  f: Fixture,
  client: PrismaClient,
  opts: {
    resolvedSellerLeadId?: string | null
    hooks?: CreateDeliveryHooks
    lockTimeoutMs?: number
  } = {}
) {
  const resolved = opts.resolvedSellerLeadId === undefined ? f.sellerId : opts.resolvedSellerLeadId
  const roots = buildDeliveryCreationRoots({
    vehicleId: f.vehicleId,
    sellerLeadId: resolved,
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
          resolvedSellerLeadId: resolved,
          scheduledAt: new Date('2026-08-01T10:00:00Z'),
          responsableId: null,
          notes: null,
          actorId: f.userId,
          checklist: CHECKLIST,
        },
        opts.hooks
      ),
    { client, lockTimeoutMs: opts.lockTimeoutMs ?? 8_000 }
  )
}

const codeOf = (err: unknown) => (isDeliveryCreationError(err) ? err.code : null)

async function counts(f: Fixture) {
  const [deliveries, activas, activities] = await Promise.all([
    prismaA.delivery.count({ where: { vehicleId: f.vehicleId } }),
    prismaA.delivery.count({
      where: { vehicleId: f.vehicleId, status: { in: ['PROGRAMADA', 'EN_CURSO'] } },
    }),
    prismaA.activity.count({ where: { buyerLeadId: f.buyerId, type: 'ENTREGA_PROGRAMADA' } }),
  ])
  return { deliveries, activas, activities }
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

describe('createDeliveryTx · contrato', () => {
  it('crea Delivery con offerId + Activity desde Offer CONVERTIDA y Vehicle RESERVADO', async () => {
    const f = await seed('RESERVADO', 'CONVERTIDA')
    const res = await create(f, prismaA)
    const delivery = await prismaA.delivery.findUniqueOrThrow({ where: { id: res.deliveryId } })
    expect(delivery.offerId).toBe(f.offerId)
    expect(delivery.status).toBe('PROGRAMADA')
    const c = await counts(f)
    expect(c).toEqual({ deliveries: 1, activas: 1, activities: 1 })
  })

  it.each([
    ['PUBLICADO', 'CONVERTIDA', 'VEHICLE_NOT_READY_FOR_DELIVERY'],
    ['NUEVO', 'CONVERTIDA', 'VEHICLE_NOT_READY_FOR_DELIVERY'],
    ['RESERVADO', 'ACEPTADA', 'OFFER_NOT_CONVERTED'],
    ['RESERVADO', 'PROPUESTA', 'OFFER_NOT_CONVERTED'],
  ] as const)('rechaza Vehicle=%s Offer=%s → %s, sin escribir', async (vs, os, expected) => {
    const f = await seed(vs, os)
    const err = await create(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe(expected)
    const c = await counts(f)
    expect(c.deliveries).toBe(0)
    expect(c.activities).toBe(0)
  })

  it('rechaza vendedor archivado → LEAD_ARCHIVED', async () => {
    const f = await seed()
    await prismaA.sellerLead.update({ where: { id: f.sellerId }, data: { archivedAt: new Date() } })
    const err = await create(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe('LEAD_ARCHIVED')
    expect((await counts(f)).deliveries).toBe(0)
  })

  it('el vehículo cambió de vendedor entre resolución y relectura → DELIVERY_ROOT_CHANGED', async () => {
    const f = await seed()
    const s2 = uniqueSuffix()
    const otro = await prismaA.sellerLead.create({
      data: { name: `S2 ${s2}`, email: `s2_${s2}@integ.test`, phone: '600000002' },
    })
    cleanups.push(async () => {
      await prismaA.sellerLead.deleteMany({ where: { id: otro.id } })
    })
    await prismaA.vehicle.update({ where: { id: f.vehicleId }, data: { sellerLeadId: otro.id } })
    const err = await create(f, prismaA, { resolvedSellerLeadId: f.sellerId }).catch((e) => e)
    expect(codeOf(err)).toBe('DELIVERY_ROOT_CHANGED')
    expect((await counts(f)).deliveries).toBe(0)
  })

  it('recreación: tras CANCELADA se permite; sobre una activa se rechaza', async () => {
    const f = await seed()
    const first = await create(f, prismaA)
    // Una segunda con la primera aún activa → DELIVERY_ALREADY_ACTIVE.
    const err = await create(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe('DELIVERY_ALREADY_ACTIVE')
    // Cancelar la primera y reintentar → permitido.
    await prismaA.delivery.update({
      where: { id: first.deliveryId },
      data: { status: 'CANCELADA' },
    })
    const second = await create(f, prismaA)
    expect(second.deliveryId).not.toBe(first.deliveryId)
    expect((await counts(f)).activas).toBe(1)
  })

  it('rollback: si la Activity falla, la Delivery revierte', async () => {
    const f = await seed()
    // actorId inexistente → la FK de Activity.agentId falla tras crear la Delivery.
    const roots = buildDeliveryCreationRoots({
      vehicleId: f.vehicleId,
      sellerLeadId: f.sellerId,
      buyerLeadId: f.buyerId,
    })
    const err = await withLockedRoots(
      roots,
      (tx) =>
        createDeliveryTx(tx, {
          vehicleId: f.vehicleId,
          buyerLeadId: f.buyerId,
          offerId: f.offerId,
          resolvedSellerLeadId: f.sellerId,
          scheduledAt: new Date('2026-08-01T10:00:00Z'),
          responsableId: null,
          notes: null,
          actorId: 'usuario-inexistente',
          checklist: CHECKLIST,
        }),
      { client: prismaA, lockTimeoutMs: 8_000 }
    ).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(isDeliveryCreationError(err)).toBe(false)
    expect((await counts(f)).deliveries).toBe(0)
  })

  it('lock timeout: no crea nada', async () => {
    const f = await seed()
    const held = barrier()
    const release = barrier()
    // A retiene el lock del vehículo dentro de su creación (pausa antes del insert).
    const holder = create(f, prismaA, {
      hooks: {
        beforeWrite: async () => {
          held.open()
          await release.wait
        },
      },
    })
    await held.wait
    const err = await create(f, prismaB, { lockTimeoutMs: 250 }).catch((e) => e)
    expect(err).toBeInstanceOf(LockError)
    release.open()
    await holder
    expect((await counts(f)).deliveries).toBe(1)
  })

  it('dos creaciones concurrentes: exactamente una gana, la otra recibe conflicto', async () => {
    const f = await seed()
    const aLocked = barrier()
    const releaseA = barrier()
    const a = create(f, prismaA, {
      hooks: {
        beforeWrite: async () => {
          aLocked.open()
          await releaseA.wait
        },
      },
    }).catch((e) => e)
    await aLocked.wait
    const b = create(f, prismaB).catch((e) => e)
    await waitUntilBlocked()
    releaseA.open()
    const aRes = await a
    const bRes = await b
    // A gana; B, desbloqueado, relee y ve una Delivery activa → DELIVERY_ALREADY_ACTIVE.
    expect(aRes).not.toBeInstanceOf(Error)
    expect(codeOf(bRes)).toBe('DELIVERY_ALREADY_ACTIVE')
    expect((await counts(f)).activas).toBe(1)
  })
})

describe('índice único parcial deliveries_active_vehicle_key', () => {
  /** Inserta una Delivery directa con estado dado (evita el núcleo, prueba solo la BD). */
  async function insertDirect(f: Fixture, status: DeliveryStatus) {
    return prismaA.delivery.create({
      data: {
        vehicleId: f.vehicleId,
        buyerLeadId: f.buyerId,
        offerId: f.offerId,
        status,
        scheduledAt: new Date(),
      },
    })
  }

  it.each([
    ['PROGRAMADA', 'PROGRAMADA'],
    ['PROGRAMADA', 'EN_CURSO'],
    ['EN_CURSO', 'EN_CURSO'],
  ] as const)('rechaza dos activas (%s + %s) sobre el mismo vehículo', async (a, b) => {
    const f = await seed()
    await insertDirect(f, a)
    const err = await insertDirect(f, b).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(String(err.message)).toMatch(new RegExp(ACTIVE_DELIVERY_UNIQUE_INDEX))
  })

  it.each([
    ['CANCELADA', 'PROGRAMADA'],
    ['CANCELADA', 'EN_CURSO'],
    ['COMPLETADA', 'PROGRAMADA'],
  ] as const)(
    'permite una %s + una nueva %s (solo la aplicación veta tras COMPLETADA)',
    async (a, b) => {
      const f = await seed()
      await insertDirect(f, a)
      const ok = await insertDirect(f, b)
      expect(ok.id).toBeTruthy()
    }
  )

  it('permite activas en vehículos distintos', async () => {
    const f1 = await seed()
    const f2 = await seed()
    await insertDirect(f1, 'PROGRAMADA')
    const ok = await insertDirect(f2, 'PROGRAMADA')
    expect(ok.id).toBeTruthy()
  })
})

describe('FK Delivery.offer_id · NoAction y cascada convergente', () => {
  it('catálogo: la FK es NO ACTION (delete) + CASCADE (update)', async () => {
    const rows = await prismaObs.$queryRaw<
      Array<{
        confdeltype: string
        confupdtype: string
        condeferrable: boolean
        condeferred: boolean
        convalidated: boolean
      }>
    >`
      SELECT confdeltype, confupdtype, condeferrable, condeferred, convalidated
      FROM pg_constraint WHERE conname = 'deliveries_offer_id_fkey'`
    expect(rows).toHaveLength(1)
    expect(rows[0].confdeltype).toBe('a') // NO ACTION
    expect(rows[0].confupdtype).toBe('c') // CASCADE
    expect(rows[0].condeferrable).toBe(false)
    expect(rows[0].condeferred).toBe(false)
    expect(rows[0].convalidated).toBe(true)
  })

  it('borrar la Offer directamente falla mientras tenga Delivery', async () => {
    const f = await seed()
    await create(f, prismaA)
    const err = await prismaA.offer.delete({ where: { id: f.offerId } }).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    // Nada se borra parcialmente.
    expect(await prismaA.offer.count({ where: { id: f.offerId } })).toBe(1)
    expect((await counts(f)).deliveries).toBe(1)
  })

  it('borrar el Vehicle padre elimina Offer y Delivery en cascada convergente', async () => {
    const f = await seed()
    await create(f, prismaA)
    // Sin warranty (blocker preexistente). Delivery cascada desde Vehicle; Offer cascada desde
    // Vehicle; la FK NoAction difiere la verificación → el borrado converge sin huérfanos.
    await prismaA.deliveryChecklistItem.deleteMany({
      where: { delivery: { vehicleId: f.vehicleId } },
    })
    await prismaA.vehicle.delete({ where: { id: f.vehicleId } })
    expect(await prismaA.offer.count({ where: { vehicleId: f.vehicleId } })).toBe(0)
    expect(await prismaA.delivery.count({ where: { vehicleId: f.vehicleId } })).toBe(0)
  })
})

describe('contract I3C1B: un INSERT sin offer_id es rechazado (prueba física)', () => {
  // `INSERT WITHOUT offer_id IS REJECTED AFTER I3C1B`. Tras el contract la columna es NOT NULL, así
  // que un INSERT directo que omite `offer_id` falla en PostgreSQL. El cliente pre-I3C1A (que no
  // conoce la columna) ya no puede crear Deliveries: esa incompatibilidad histórica es esperada, no
  // un fallo. La compatibilidad del cliente ACTUALMENTE desplegado se demuestra aparte en
  // `old-client-compat.test.ts`, generando el cliente de `aa739cc` (que sí persiste `offerId`).
  it('un INSERT que omite offer_id es rechazado por NOT NULL, sin fila creada', async () => {
    const f = await seed()
    const before = await counts(f)
    const err = await prismaA.$queryRaw`
      INSERT INTO "deliveries" ("id","vehicle_id","buyer_lead_id","scheduled_at","status","created_at","updated_at")
      VALUES (${'legacy_' + uniqueSuffix()}, ${f.vehicleId}, ${f.buyerId}, ${new Date()}, 'PROGRAMADA'::"DeliveryStatus", ${new Date()}, ${new Date()})
      RETURNING "id", "offer_id"`.catch((e) => e)
    // Error NOT NULL real de PostgreSQL (SQLSTATE 23502). Prisma en raw NO incluye el nombre de la
    // columna; devuelve el código 23502 y "Failing row contains (…, null, …)".
    expect(err).toBeInstanceOf(Error)
    const message = err instanceof Error ? err.message : String(err)
    expect(message).toContain('23502')
    expect(message.toLowerCase()).toContain('null')
    // Ninguna Delivery creada; ninguna Activity; ninguna mutación parcial.
    const after = await counts(f)
    expect(after.deliveries).toBe(before.deliveries)
    expect(after.deliveries).toBe(0)
    expect(after.activities).toBe(0)
  })
})

describe('traductor P2002 real del índice parcial', () => {
  async function insertActive(f: Fixture, client: PrismaClient) {
    return client.delivery.create({
      data: {
        vehicleId: f.vehicleId,
        buyerLeadId: f.buyerId,
        offerId: f.offerId,
        status: 'PROGRAMADA',
        scheduledAt: new Date(),
      },
    })
  }

  it('un P2002 REAL del índice parcial es CANDIDATO y la confirmación encuentra una activa', async () => {
    const f = await seed()
    await insertActive(f, prismaA)
    let captured: unknown
    try {
      await insertActive(f, prismaA)
      throw new Error('se esperaba un P2002 y no se produjo')
    } catch (e) {
      captured = e
    }
    // Metadata REAL: Prisma da modelName='Delivery', target=['vehicle_id'] (NO el nombre del índice).
    expect(isPotentialActiveDeliveryVehicleConflict(captured)).toBe(true)
    // Confirmación post-rollback (fuera de la tx abortada): hay una activa real → traducible.
    const active = await prismaA.delivery.count({
      where: { vehicleId: f.vehicleId, status: { in: ['PROGRAMADA', 'EN_CURSO'] } },
    })
    expect(active).toBeGreaterThan(0)
    expect((await counts(f)).activas).toBe(1)
  })

  it('un P2002 REAL de OTRO índice (users.email) NO es candidato', async () => {
    const s = uniqueSuffix()
    const email = `dup_${s}@integ.test`
    await prismaA.user.create({ data: { name: 'A', email, role: 'AGENTE' } })
    cleanups.push(async () => {
      await prismaA.user.deleteMany({ where: { email } })
    })
    let captured: unknown
    try {
      await prismaA.user.create({ data: { name: 'B', email, role: 'AGENTE' } })
      throw new Error('se esperaba un P2002 y no se produjo')
    } catch (e) {
      captured = e
    }
    // modelName='User' → ni siquiera candidato; el traductor lo deja pasar como técnico.
    expect(isPotentialActiveDeliveryVehicleConflict(captured)).toBe(false)
  })
})

describe('recreación tras COMPLETADA (regla de aplicación, no del índice)', () => {
  it('con una Delivery COMPLETADA previa → VEHICLE_ALREADY_DELIVERED', async () => {
    // FIXTURE ARTIFICIAL: en el flujo real, completar dejaría el vehículo VENDIDO (I3C3, aún no
    // coordinado). Aquí se fuerza el vehículo a RESERVADO con una Delivery COMPLETADA para
    // ejercitar SOLO la regla de aplicación: no se recrea sobre una entrega completada. El índice
    // parcial por sí solo lo permitiría (COMPLETADA no es activa); la aplicación lo veta.
    const f = await seed()
    const first = await create(f, prismaA)
    await prismaA.delivery.update({
      where: { id: first.deliveryId },
      data: { status: 'COMPLETADA' },
    })
    const before = await counts(f)
    const err = await create(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe('VEHICLE_ALREADY_DELIVERED')
    const after = await counts(f)
    expect(after.deliveries).toBe(before.deliveries)
  })
})
