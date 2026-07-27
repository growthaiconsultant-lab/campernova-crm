/**
 * Tests de integración con PostgreSQL REAL (PR-A2) — validación/anulación de la entrada oficial,
 * el índice único parcial de orden de inspección activa y el protocolo de root locks.
 *
 * Demuestran:
 *   · validateEntryTx crea la entrada + EXACTAMENTE UNA orden INSPECCION_ENTRADA, bajo locks;
 *   · precondición por precondición: cada requisito incumplido rechaza sin escribir nada;
 *   · dos validaciones concurrentes → una gana, la otra ve entrada ya validada (exactamente 1 orden);
 *   · si la creación de la orden/Activity falla, TODA la tx revierte (no hay entrada sin inspección);
 *   · CAS: revalidar una entrada ya validada NO crea una segunda orden;
 *   · el índice `work_orders_active_inspection_key` rechaza dos órdenes de inspección activas;
 *   · anulación terminal: doble anulación → ENTRY_NOT_ACTIVE; re-validar tras anular → terminal;
 *   · el estado de la entrada se lee de las COLUMNAS del vehículo, no parseando Activity.
 *
 * Barreras deterministas y varias conexiones; sin `sleep` como sincronización.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient, WorkOrderStatus } from '@prisma/client'
import { withLockedRoots, LockError } from '@/lib/locking'
import {
  validateEntryTx,
  annulEntryTx,
  registerPhysicalArrivalTx,
  buildEntryRoots,
  isEntryError,
  isPotentialActiveInspectionConflict,
  ACTIVE_INSPECTION_UNIQUE_INDEX,
  type ValidateEntryHooks,
  type RegisterArrivalHooks,
} from '@/lib/entry'
import { PUBLICADO_REQUIRED_DOCS } from '@/lib/vehicle-legal'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

const PUBLICADO_REQUIRED_DOCS_FOR_TEST = PUBLICADO_REQUIRED_DOCS

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
    if (Date.now() > deadline) throw new Error('la otra operación nunca esperó un lock')
    await new Promise((r) => setTimeout(r, 25))
  }
}

type Fixture = {
  userId: string
  sellerId: string
  vehicleId: string
}

type SeedOpts = {
  withResponsible?: boolean // seller.agentId set
  withContrato?: boolean // CONTRATO_GESTION con versión ACTIVE
  classifyRequired?: boolean // dispone (NO_APLICABLE) las 7 requeridas
  withPlate?: boolean
  withVin?: boolean // identificador alternativo (vehículo sin matrícula)
  withDesiredPrice?: boolean
  withPhoto?: boolean
  withArrival?: boolean // physical_arrival_at ya registrado (hito previo, corrección 7.1)
}

const FULL: Required<SeedOpts> = {
  withResponsible: true,
  withContrato: true,
  classifyRequired: true,
  withPlate: true,
  withVin: false, // identificación por matrícula por defecto; VIN es la alternativa
  withDesiredPrice: true,
  withPhoto: true,
  withArrival: true,
}

/** Siembra un vehículo TASADO con expediente/documentos según `opts`. */
async function seed(opts: SeedOpts = FULL): Promise<Fixture> {
  const o = { ...FULL, ...opts }
  const s = uniqueSuffix()
  const user = await prismaA.user.create({
    data: { name: `U ${s}`, email: `u_${s}@integ.test`, role: 'AGENTE' },
  })
  const seller = await prismaA.sellerLead.create({
    data: {
      name: `S ${s}`,
      email: `s_${s}@integ.test`,
      phone: '600000000',
      agentId: o.withResponsible ? user.id : null,
    },
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
      status: 'TASADO',
      plate: o.withPlate ? `1234-ABC-${s.slice(0, 3)}` : null,
      vin: o.withVin ? `VF1${s.slice(0, 14).toUpperCase()}` : null,
      desiredPrice: o.withDesiredPrice ? 30000 : null,
      physicalArrivalAt: o.withArrival ? new Date() : null,
      physicalArrivalById: o.withArrival ? user.id : null,
    },
  })
  if (o.withPhoto) {
    await prismaA.vehiclePhoto.create({ data: { vehicleId: vehicle.id, url: 'x', order: 0 } })
  }
  if (o.withContrato) {
    const doc = await prismaA.vehicleDocument.create({
      data: { vehicleId: vehicle.id, category: 'CONTRATO_GESTION', name: 'contrato', url: 'obj' },
    })
    await prismaA.documentVersion.create({
      data: {
        vehicleDocumentId: doc.id,
        version: 1,
        bucket: 'vehicle-documents',
        objectPath: `docs/${uniqueSuffix()}`,
        status: 'ACTIVE',
      },
    })
  }
  if (o.classifyRequired) {
    for (const category of PUBLICADO_REQUIRED_DOCS_FOR_TEST) {
      await prismaA.vehicleDocumentRequirementDisposition.create({
        data: { vehicleId: vehicle.id, category, disposition: 'NO_APLICABLE' },
      })
    }
  }

  cleanups.push(async () => {
    await prismaA.activity.deleteMany({ where: { sellerLeadId: seller.id } })
    await prismaA.workOrderChecklist.deleteMany({ where: { workOrder: { vehicleId: vehicle.id } } })
    await prismaA.workOrder.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.documentVersion.deleteMany({
      where: { vehicleDocument: { vehicleId: vehicle.id } },
    })
    await prismaA.vehicleDocument.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.vehicleDocumentRequirementDisposition.deleteMany({
      where: { vehicleId: vehicle.id },
    })
    await prismaA.vehiclePhoto.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prismaA.sellerLead.deleteMany({ where: { id: seller.id } })
    await prismaA.user.deleteMany({ where: { id: user.id } })
  })

  return { userId: user.id, sellerId: seller.id, vehicleId: vehicle.id }
}

function validate(
  f: Fixture,
  client: PrismaClient,
  opts: {
    actorId?: string
    resolvedSellerLeadId?: string | null
    hooks?: ValidateEntryHooks
    lockTimeoutMs?: number
  } = {}
) {
  const resolved = opts.resolvedSellerLeadId === undefined ? f.sellerId : opts.resolvedSellerLeadId
  const roots = buildEntryRoots({ vehicleId: f.vehicleId, sellerLeadId: resolved })
  return withLockedRoots(
    roots,
    (tx) =>
      validateEntryTx(
        tx,
        {
          vehicleId: f.vehicleId,
          resolvedSellerLeadId: resolved,
          actorId: opts.actorId ?? f.userId,
          parkingLocation: 'Nave A-3',
          keysCount: 2,
          keysLocation: 'Panel',
          keysNotes: null,
        },
        opts.hooks
      ),
    { client, lockTimeoutMs: opts.lockTimeoutMs ?? 8_000 }
  )
}

function registerArrival(
  f: Fixture,
  client: PrismaClient,
  opts: { actorId?: string; hooks?: RegisterArrivalHooks } = {}
) {
  const roots = buildEntryRoots({ vehicleId: f.vehicleId, sellerLeadId: f.sellerId })
  return withLockedRoots(
    roots,
    (tx) =>
      registerPhysicalArrivalTx(
        tx,
        {
          vehicleId: f.vehicleId,
          resolvedSellerLeadId: f.sellerId,
          actorId: opts.actorId ?? f.userId,
        },
        opts.hooks
      ),
    { client }
  )
}

const codeOf = (err: unknown) => (isEntryError(err) ? err.code : null)

async function counts(f: Fixture) {
  const [orders, activeOrders, validatedActivities] = await Promise.all([
    prismaA.workOrder.count({ where: { vehicleId: f.vehicleId, kind: 'INSPECCION_ENTRADA' } }),
    prismaA.workOrder.count({
      where: {
        vehicleId: f.vehicleId,
        kind: 'INSPECCION_ENTRADA',
        status: { in: ['PENDIENTE', 'EN_DIAGNOSTICO', 'PRESUPUESTADA', 'EN_CURSO'] },
      },
    }),
    prismaA.activity.count({ where: { sellerLeadId: f.sellerId, type: 'ENTRADA_VALIDADA' } }),
  ])
  return { orders, activeOrders, validatedActivities }
}

async function entryState(vehicleId: string) {
  return prismaA.vehicle.findUniqueOrThrow({
    where: { id: vehicleId },
    select: {
      physicalArrivalAt: true,
      physicalArrivalById: true,
      entryValidatedAt: true,
      entryValidatedById: true,
      entryAnnulledAt: true,
      entryAnnulmentReason: true,
      keysCount: true,
      keysLocation: true,
      naveLocation: true,
    },
  })
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

describe('registerPhysicalArrivalTx · hito previo persistido (corrección 7.1)', () => {
  it('registra la llegada (fecha + actor) y habilita la validación', async () => {
    const f = await seed({ withArrival: false })
    // Sin llegada registrada, la validación se rechaza.
    expect(codeOf(await validate(f, prismaA).catch((e) => e))).toBe('VEHICLE_NOT_PRESENT')

    const res = await registerArrival(f, prismaA)
    expect(res.alreadyRegistered).toBe(false)
    const st = await entryState(f.vehicleId)
    expect(st.physicalArrivalAt).not.toBeNull()
    expect(st.physicalArrivalById).toBe(f.userId)
    // Trazado con Activity dedicada, NO fuente de verdad.
    expect(
      await prismaA.activity.count({
        where: { sellerLeadId: f.sellerId, type: 'LLEGADA_REGISTRADA' },
      })
    ).toBe(1)

    // Ahora la validación pasa.
    const done = await validate(f, prismaA)
    expect(done.workOrderId).toBeTruthy()
    // La validación NO reescribe physicalArrivalAt (hito distinto y anterior).
    expect((await entryState(f.vehicleId)).physicalArrivalById).toBe(f.userId)
  })

  it('idempotente: re-registrar es no-op (no reescribe ni duplica Activity)', async () => {
    const f = await seed({ withArrival: false })
    const r1 = await registerArrival(f, prismaA)
    expect(r1.alreadyRegistered).toBe(false)
    const firstAt = (await entryState(f.vehicleId)).physicalArrivalAt

    const r2 = await registerArrival(f, prismaA)
    expect(r2.alreadyRegistered).toBe(true)
    expect((await entryState(f.vehicleId)).physicalArrivalAt).toEqual(firstAt)
    expect(
      await prismaA.activity.count({
        where: { sellerLeadId: f.sellerId, type: 'LLEGADA_REGISTRADA' },
      })
    ).toBe(1)
  })

  it('vendedor archivado → LEAD_ARCHIVED', async () => {
    const f = await seed({ withArrival: false })
    await prismaA.sellerLead.update({ where: { id: f.sellerId }, data: { archivedAt: new Date() } })
    expect(codeOf(await registerArrival(f, prismaA).catch((e) => e))).toBe('LEAD_ARCHIVED')
    expect((await entryState(f.vehicleId)).physicalArrivalAt).toBeNull()
  })

  it('dos registros concurrentes: exactamente uno escribe, una sola Activity', async () => {
    const f = await seed({ withArrival: false })
    const aLocked = barrier()
    const releaseA = barrier()
    const a = registerArrival(f, prismaA, {
      hooks: {
        beforeWrite: async () => {
          aLocked.open()
          await releaseA.wait
        },
      },
    }).catch((e) => e)
    await aLocked.wait
    const b = registerArrival(f, prismaB).catch((e) => e)
    await waitUntilBlocked()
    releaseA.open()
    const aRes = await a
    const bRes = await b
    expect(aRes).not.toBeInstanceOf(Error)
    // El segundo, ya con la llegada registrada, es no-op idempotente.
    expect(bRes).not.toBeInstanceOf(Error)
    expect((bRes as { alreadyRegistered: boolean }).alreadyRegistered).toBe(true)
    expect(
      await prismaA.activity.count({
        where: { sellerLeadId: f.sellerId, type: 'LLEGADA_REGISTRADA' },
      })
    ).toBe(1)
  })
})

describe('validateEntryTx · camino feliz', () => {
  it('crea la entrada + EXACTAMENTE una orden de inspección + Activity, leyendo el estado de las columnas', async () => {
    const f = await seed()
    const res = await validate(f, prismaA)
    expect(res.workOrderId).toBeTruthy()

    const c = await counts(f)
    expect(c).toEqual({ orders: 1, activeOrders: 1, validatedActivities: 1 })

    // Estado leído de las COLUMNAS del vehículo, sin parsear Activity.
    const st = await entryState(f.vehicleId)
    expect(st.entryValidatedAt).not.toBeNull()
    expect(st.entryValidatedById).toBe(f.userId)
    expect(st.entryAnnulledAt).toBeNull()
    expect(st.keysCount).toBe(2)
    expect(st.keysLocation).toBe('Panel')
    expect(st.naveLocation).toBe('Nave A-3')

    // La orden creada es INSPECCION_ENTRADA con checklist.
    const order = await prismaA.workOrder.findFirstOrThrow({
      where: { vehicleId: f.vehicleId, kind: 'INSPECCION_ENTRADA' },
      include: { _count: { select: { checklist: true } } },
    })
    expect(order._count.checklist).toBeGreaterThan(0)
  })
})

describe('validateEntryTx · precondición por precondición (rechaza sin escribir)', () => {
  it.each([
    ['sin contrato de gestión vigente', { withContrato: false }, 'CONTRATO_GESTION_MISSING'],
    [
      'documentos requeridos sin clasificar',
      { classifyRequired: false },
      'CHECKLIST_NOT_CLASSIFIED',
    ],
    ['sin comercial responsable', { withResponsible: false }, 'RESPONSIBLE_NOT_SET'],
    // Expediente mínimo de entrada = identificación (matrícula O VIN). NO exige foto ni precio.
    [
      'expediente incompleto (sin matrícula NI VIN)',
      { withPlate: false, withVin: false },
      'EXPEDIENTE_INCOMPLETE',
    ],
  ] as const)('%s → %s', async (_label, opts, expected) => {
    const f = await seed(opts)
    const err = await validate(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe(expected)
    const c = await counts(f)
    expect(c).toEqual({ orders: 0, activeOrders: 0, validatedActivities: 0 })
    expect((await entryState(f.vehicleId)).entryValidatedAt).toBeNull()
  })

  it('valida la entrada SIN desiredPrice y SIN fotografías (expediente de entrada ≠ TASADO)', async () => {
    const f = await seed({ withDesiredPrice: false, withPhoto: false })
    const res = await validate(f, prismaA)
    expect(res.workOrderId).toBeTruthy()
    const st = await entryState(f.vehicleId)
    expect(st.entryValidatedAt).not.toBeNull()
    expect(st.entryValidatedById).toBe(f.userId)
    expect(await counts(f)).toEqual({ orders: 1, activeOrders: 1, validatedActivities: 1 })
  })

  it('valida la entrada con VIN y SIN matrícula (vehículo aún no matriculado)', async () => {
    const f = await seed({ withPlate: false, withVin: true })
    const res = await validate(f, prismaA)
    expect(res.workOrderId).toBeTruthy()
    expect((await entryState(f.vehicleId)).entryValidatedAt).not.toBeNull()
    expect(await counts(f)).toEqual({ orders: 1, activeOrders: 1, validatedActivities: 1 })
  })

  it('sin llegada física registrada → VEHICLE_NOT_PRESENT (corrección 7.1)', async () => {
    const f = await seed({ withArrival: false })
    const err = await validate(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe('VEHICLE_NOT_PRESENT')
    expect((await counts(f)).orders).toBe(0)
    expect((await entryState(f.vehicleId)).entryValidatedAt).toBeNull()
  })

  it('sin llaves (cantidad 0) → KEYS_NOT_RECEIVED', async () => {
    const f = await seed()
    const roots = buildEntryRoots({ vehicleId: f.vehicleId, sellerLeadId: f.sellerId })
    const err = await withLockedRoots(
      roots,
      (tx) =>
        validateEntryTx(tx, {
          vehicleId: f.vehicleId,
          resolvedSellerLeadId: f.sellerId,
          actorId: f.userId,
          parkingLocation: 'Nave A-3',
          keysCount: 0,
          keysLocation: 'Panel',
          keysNotes: null,
        }),
      { client: prismaA }
    ).catch((e) => e)
    expect(codeOf(err)).toBe('KEYS_NOT_RECEIVED')
  })

  it('CONTRATO_GESTION dispuesto como NO_APLICABLE NO cuenta como recibido → CONTRATO_GESTION_MISSING', async () => {
    const f = await seed({ withContrato: false })
    await prismaA.vehicleDocumentRequirementDisposition.create({
      data: { vehicleId: f.vehicleId, category: 'CONTRATO_GESTION', disposition: 'NO_APLICABLE' },
    })
    const err = await validate(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe('CONTRATO_GESTION_MISSING')
  })

  it('vendedor archivado → LEAD_ARCHIVED', async () => {
    const f = await seed()
    await prismaA.sellerLead.update({ where: { id: f.sellerId }, data: { archivedAt: new Date() } })
    const err = await validate(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe('LEAD_ARCHIVED')
  })

  it('el vehículo cambió de vendedor entre resolución y relectura → VEHICLE_ROOT_CHANGED', async () => {
    const f = await seed()
    const s2 = uniqueSuffix()
    const otro = await prismaA.sellerLead.create({
      data: {
        name: `S2 ${s2}`,
        email: `s2_${s2}@integ.test`,
        phone: '600000002',
        agentId: f.userId,
      },
    })
    cleanups.push(async () => {
      await prismaA.sellerLead.deleteMany({ where: { id: otro.id } })
    })
    await prismaA.vehicle.update({ where: { id: f.vehicleId }, data: { sellerLeadId: otro.id } })
    const err = await validate(f, prismaA, { resolvedSellerLeadId: f.sellerId }).catch((e) => e)
    expect(codeOf(err)).toBe('VEHICLE_ROOT_CHANGED')
  })
})

describe('validateEntryTx · idempotencia y CAS', () => {
  it('revalidar una entrada ya validada → ENTRY_ALREADY_VALIDATED, SIN segunda orden', async () => {
    const f = await seed()
    await validate(f, prismaA)
    const before = await counts(f)
    const err = await validate(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe('ENTRY_ALREADY_VALIDATED')
    const after = await counts(f)
    expect(after).toEqual(before)
    expect(after.orders).toBe(1)
  })

  it('rollback total: si la Activity falla (actor inexistente), no queda ni entrada ni orden', async () => {
    const f = await seed()
    const err = await validate(f, prismaA, { actorId: 'usuario-inexistente' }).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(isEntryError(err)).toBe(false)
    const c = await counts(f)
    expect(c).toEqual({ orders: 0, activeOrders: 0, validatedActivities: 0 })
    expect((await entryState(f.vehicleId)).entryValidatedAt).toBeNull()
  })

  it('lock timeout: no valida nada', async () => {
    const f = await seed()
    const held = barrier()
    const release = barrier()
    const holder = validate(f, prismaA, {
      hooks: {
        beforeWrite: async () => {
          held.open()
          await release.wait
        },
      },
    })
    await held.wait
    const err = await validate(f, prismaB, { lockTimeoutMs: 250 }).catch((e) => e)
    expect(err).toBeInstanceOf(LockError)
    release.open()
    await holder
    expect((await counts(f)).orders).toBe(1)
  })

  it('dos validaciones concurrentes: exactamente una entrada + una orden', async () => {
    const f = await seed()
    const aLocked = barrier()
    const releaseA = barrier()
    const a = validate(f, prismaA, {
      hooks: {
        beforeWrite: async () => {
          aLocked.open()
          await releaseA.wait
        },
      },
    }).catch((e) => e)
    await aLocked.wait
    const b = validate(f, prismaB).catch((e) => e)
    await waitUntilBlocked()
    releaseA.open()
    const aRes = await a
    const bRes = await b
    expect(aRes).not.toBeInstanceOf(Error)
    expect(codeOf(bRes)).toBe('ENTRY_ALREADY_VALIDATED')
    const c = await counts(f)
    expect(c.orders).toBe(1)
    expect(c.activeOrders).toBe(1)
  })
})

describe('índice único parcial work_orders_active_inspection_key', () => {
  async function insertOrder(f: Fixture, status: WorkOrderStatus) {
    return prismaA.workOrder.create({
      data: {
        vehicleId: f.vehicleId,
        kind: 'INSPECCION_ENTRADA',
        status,
        description: 'insp',
      },
    })
  }

  it.each([
    ['PENDIENTE', 'PENDIENTE'],
    ['PENDIENTE', 'EN_CURSO'],
    ['EN_DIAGNOSTICO', 'PRESUPUESTADA'],
  ] as const)('rechaza dos inspecciones activas (%s + %s) por vehículo', async (a, b) => {
    const f = await seed()
    await insertOrder(f, a)
    const err = await insertOrder(f, b).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(String(err.message)).toMatch(new RegExp(ACTIVE_INSPECTION_UNIQUE_INDEX))
  })

  it('permite recrear tras COMPLETADA/RECHAZADA (no activa)', async () => {
    const f = await seed()
    await insertOrder(f, 'COMPLETADA')
    const ok = await insertOrder(f, 'PENDIENTE')
    expect(ok.id).toBeTruthy()
  })

  it('una REPARACION activa no colisiona con una INSPECCION_ENTRADA activa (índice filtra por kind)', async () => {
    const f = await seed()
    await prismaA.workOrder.create({
      data: { vehicleId: f.vehicleId, kind: 'REPARACION', status: 'PENDIENTE', description: 'rep' },
    })
    const ok = await insertOrder(f, 'PENDIENTE')
    expect(ok.id).toBeTruthy()
  })

  it('el P2002 del índice parcial es CANDIDATO y la confirmación encuentra una activa', async () => {
    const f = await seed()
    await insertOrder(f, 'PENDIENTE')
    let captured: unknown
    try {
      await insertOrder(f, 'PENDIENTE')
      throw new Error('se esperaba un P2002')
    } catch (e) {
      captured = e
    }
    expect(isPotentialActiveInspectionConflict(captured)).toBe(true)
    const active = await prismaA.workOrder.count({
      where: {
        vehicleId: f.vehicleId,
        kind: 'INSPECCION_ENTRADA',
        status: { in: ['PENDIENTE', 'EN_DIAGNOSTICO', 'PRESUPUESTADA', 'EN_CURSO'] },
      },
    })
    expect(active).toBeGreaterThan(0)
  })
})

function annul(
  f: Fixture,
  client: PrismaClient,
  reason: Parameters<typeof annulEntryTx>[1]['reason'],
  notes: string | null = null
) {
  const roots = buildEntryRoots({ vehicleId: f.vehicleId, sellerLeadId: f.sellerId })
  return withLockedRoots(
    roots,
    (tx) =>
      annulEntryTx(tx, {
        vehicleId: f.vehicleId,
        resolvedSellerLeadId: f.sellerId,
        actorId: f.userId,
        reason,
        notes,
      }),
    { client }
  )
}

describe('annulEntryTx · terminal', () => {
  it('anula una entrada activa y escribe las columnas de anulación', async () => {
    const f = await seed()
    await validate(f, prismaA)
    await annul(f, prismaA, 'DUPLICADO')
    const st = await entryState(f.vehicleId)
    expect(st.entryAnnulledAt).not.toBeNull()
    expect(st.entryAnnulmentReason).toBe('DUPLICADO')
  })

  it('cierra la orden de inspección activa al anular (corrección 7.2)', async () => {
    const f = await seed()
    const done = await validate(f, prismaA)
    // Antes de anular: una inspección activa.
    expect((await counts(f)).activeOrders).toBe(1)

    const res = await annul(f, prismaA, 'DUPLICADO')
    expect(res.inspectionOrdersClosed).toBe(1)

    // La orden de inspección queda RECHAZADA (terminal): 0 activas, la fila sigue existiendo.
    const c = await counts(f)
    expect(c.orders).toBe(1)
    expect(c.activeOrders).toBe(0)
    const order = await prismaA.workOrder.findUniqueOrThrow({ where: { id: done.workOrderId } })
    expect(order.status).toBe('RECHAZADA')
    // Traza del cierre.
    expect(
      await prismaA.activity.count({
        where: { sellerLeadId: f.sellerId, type: 'ORDEN_TALLER_RECHAZADA' },
      })
    ).toBe(1)
  })

  it('doble anulación → ENTRY_NOT_ACTIVE (terminal)', async () => {
    const f = await seed()
    await validate(f, prismaA)
    await annul(f, prismaA, 'DUPLICADO')
    const err = await annul(f, prismaA, 'DUPLICADO').catch((e) => e)
    expect(codeOf(err)).toBe('ENTRY_NOT_ACTIVE')
  })

  it('anular sin entrada activa → ENTRY_NOT_ACTIVE', async () => {
    const f = await seed()
    const err = await annul(f, prismaA, 'DUPLICADO').catch((e) => e)
    expect(codeOf(err)).toBe('ENTRY_NOT_ACTIVE')
  })

  it('motivo OTRO sin notas → ANNULMENT_NOTES_REQUIRED', async () => {
    const f = await seed()
    await validate(f, prismaA)
    const err = await annul(f, prismaA, 'OTRO', null).catch((e) => e)
    expect(codeOf(err)).toBe('ANNULMENT_NOTES_REQUIRED')
    // No se anuló: la entrada sigue activa.
    expect((await entryState(f.vehicleId)).entryAnnulledAt).toBeNull()
  })

  it('re-validar una entrada anulada → ENTRY_ANNULLED_TERMINAL (sin revalidación en v1)', async () => {
    const f = await seed()
    await validate(f, prismaA)
    await annul(f, prismaA, 'DUPLICADO')
    const err = await validate(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe('ENTRY_ANNULLED_TERMINAL')
  })
})
