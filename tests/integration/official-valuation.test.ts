/**
 * Tests de integración con PostgreSQL REAL (A3) — tasación OFICIAL bajo el protocolo de root locks.
 *
 * Demuestran:
 *   · gate estricto: sin entrada activa / sin inspección COMPLETADA / vendedor archivado /
 *     estado VENDIDO|DESCARTADO → rechazo SIN escribir;
 *   · camino feliz manual: crea Valuation OFICIAL + intento COMPLETADA + denormalizados oficiales +
 *     transición `NUEVO → TASADO` + Activity, todo atómico y bajo el lock;
 *   · la confianza es la DECLARADA (no hardcode ALTA);
 *   · re-tasación sobre un vehículo ya TASADO: nueva Valuation, sin transición;
 *   · AUTO sin datos → intento OFICIAL SIN_REFERENCIA persistido, SIN tocar el vehículo;
 *   · rollback total: si la Activity falla (actor inexistente), no queda Valuation ni cambio de estado;
 *   · dos tasaciones concurrentes: se serializan, exactamente una transición `NUEVO → TASADO`;
 *   · lock timeout: la segunda no escribe nada.
 *
 * Barreras deterministas y varias conexiones; sin `sleep` como sincronización.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { withLockedRoots, LockError } from '@/lib/locking'
import {
  officialValuationTx,
  buildOfficialValuationRoots,
  isValuationError,
  officialRequestFingerprint,
  type OfficialValuationMode,
  type OfficialValuationHooks,
} from '@/lib/valuation'
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
    if (Date.now() > deadline) throw new Error('la otra operación nunca esperó un lock')
    await new Promise((r) => setTimeout(r, 25))
  }
}

type Fixture = { userId: string; sellerId: string; vehicleId: string }

type SeedOpts = {
  entryActive?: boolean
  inspectionCompleted?: boolean
  archived?: boolean
  status?: 'NUEVO' | 'TASADO' | 'PUBLICADO' | 'VENDIDO' | 'DESCARTADO'
  brand?: string
  model?: string
}

const FULL: Required<Omit<SeedOpts, 'brand' | 'model'>> = {
  entryActive: true,
  inspectionCompleted: true,
  archived: false,
  status: 'NUEVO',
}

async function seed(opts: SeedOpts = {}): Promise<Fixture> {
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
      agentId: user.id,
      archivedAt: o.archived ? new Date() : null,
    },
  })
  const vehicle = await prismaA.vehicle.create({
    data: {
      sellerLeadId: seller.id,
      brand: opts.brand ?? 'Adria',
      model: opts.model ?? 'Coral',
      year: 2020,
      km: 1000,
      seats: 4,
      type: 'AUTOCARAVANA',
      status: o.status,
      plate: `1234-ABC-${s.slice(0, 3)}`,
      physicalArrivalAt: new Date(),
      physicalArrivalById: user.id,
      entryValidatedAt: o.entryActive ? new Date() : null,
      entryValidatedById: o.entryActive ? user.id : null,
    },
  })
  if (o.inspectionCompleted) {
    await prismaA.workOrder.create({
      data: {
        vehicleId: vehicle.id,
        kind: 'INSPECCION_ENTRADA',
        status: 'COMPLETADA',
        description: 'Inspección de entrada',
      },
    })
  }

  cleanups.push(async () => {
    await prismaA.activity.deleteMany({ where: { sellerLeadId: seller.id } })
    await prismaA.vehicleValuationAttempt.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.valuation.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.workOrder.deleteMany({ where: { vehicleId: vehicle.id } })
    await prismaA.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prismaA.sellerLead.deleteMany({ where: { id: seller.id } })
    await prismaA.user.deleteMany({ where: { id: user.id } })
  })

  return { userId: user.id, sellerId: seller.id, vehicleId: vehicle.id }
}

const MANUAL: OfficialValuationMode = {
  kind: 'MANUAL',
  min: 10000,
  recommended: 12000,
  max: 14000,
  confidence: 'MEDIA',
  reason: 'Tras inspección',
}

const AUTO: OfficialValuationMode = {
  kind: 'AUTO',
  input: {
    brand: 'Adria',
    model: 'Coral',
    type: 'AUTOCARAVANA',
    year: 2020,
    km: 1000,
    conservationState: 'BUENO',
    equipment: {},
  },
}

function official(
  f: Fixture,
  client: PrismaClient,
  opts: {
    actorId?: string
    resolvedSellerLeadId?: string | null
    mode?: OfficialValuationMode
    hooks?: OfficialValuationHooks
    lockTimeoutMs?: number
    /** Clave de idempotencia. Por defecto, una nueva por llamada (intento independiente). */
    idempotencyKey?: string
  } = {}
) {
  const resolved = opts.resolvedSellerLeadId === undefined ? f.sellerId : opts.resolvedSellerLeadId
  const roots = buildOfficialValuationRoots({ vehicleId: f.vehicleId, sellerLeadId: resolved })
  return withLockedRoots(
    roots,
    (tx) =>
      officialValuationTx(
        tx,
        {
          vehicleId: f.vehicleId,
          resolvedSellerLeadId: resolved,
          actorId: opts.actorId ?? f.userId,
          idempotencyKey: opts.idempotencyKey ?? `idem_${uniqueSuffix()}`,
          mode: opts.mode ?? MANUAL,
        },
        opts.hooks
      ),
    { client, lockTimeoutMs: opts.lockTimeoutMs ?? 8_000 }
  )
}

const codeOf = (err: unknown) => (isValuationError(err) ? err.code : null)

async function state(vehicleId: string) {
  const [v, valuations, attempts] = await Promise.all([
    prismaA.vehicle.findUniqueOrThrow({
      where: { id: vehicleId },
      select: { status: true, valuationRecommended: true },
    }),
    prismaA.valuation.count({ where: { vehicleId } }),
    prismaA.vehicleValuationAttempt.count({ where: { vehicleId } }),
  ])
  return {
    status: v.status,
    hasOfficialPrice: v.valuationRecommended != null,
    valuations,
    attempts,
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

describe('officialValuationTx · gate estricto (rechaza sin escribir)', () => {
  it.each([
    ['sin entrada activa', { entryActive: false }, 'ENTRY_NOT_ACTIVE'],
    ['sin inspección completada', { inspectionCompleted: false }, 'INSPECTION_NOT_COMPLETED'],
    ['vendedor archivado', { archived: true }, 'LEAD_ARCHIVED'],
    ['estado VENDIDO', { status: 'VENDIDO' as const }, 'VEHICLE_STATUS_NOT_ELIGIBLE'],
    ['estado DESCARTADO', { status: 'DESCARTADO' as const }, 'VEHICLE_STATUS_NOT_ELIGIBLE'],
  ])('%s → %s', async (_label, opts, expected) => {
    const f = await seed(opts)
    const err = await official(f, prismaA).catch((e) => e)
    expect(codeOf(err)).toBe(expected)
    const st = await state(f.vehicleId)
    expect(st.valuations).toBe(0)
    expect(st.attempts).toBe(0)
    expect(st.hasOfficialPrice).toBe(false)
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
    const err = await official(f, prismaA, { resolvedSellerLeadId: f.sellerId }).catch((e) => e)
    expect(codeOf(err)).toBe('VEHICLE_ROOT_CHANGED')
  })
})

describe('officialValuationTx · camino feliz manual', () => {
  it('crea Valuation OFICIAL + intento + precio oficial + transición NUEVO→TASADO + Activity', async () => {
    const f = await seed()
    const res = await official(f, prismaA)
    expect(res.outcome).toBe('COMPLETADA')
    expect(res.transitioned).toBe(true)

    const st = await state(f.vehicleId)
    expect(st.status).toBe('TASADO')
    expect(st.hasOfficialPrice).toBe(true)
    expect(st.valuations).toBe(1)
    expect(st.attempts).toBe(1)

    const valuation = await prismaA.valuation.findFirstOrThrow({
      where: { vehicleId: f.vehicleId },
    })
    expect(valuation.purpose).toBe('OFICIAL')
    expect(valuation.confidence).toBe('MEDIA') // declarada, no ALTA
    expect(valuation.method).toBe('MANUAL')

    const attempt = await prismaA.vehicleValuationAttempt.findFirstOrThrow({
      where: { vehicleId: f.vehicleId },
    })
    expect(attempt.purpose).toBe('OFICIAL')
    expect(attempt.outcome).toBe('COMPLETADA')
    expect(attempt.valuationId).toBe(valuation.id)

    // Exactamente una transición NUEVO → Tasado en el timeline.
    const transitions = await prismaA.activity.count({
      where: { sellerLeadId: f.sellerId, content: { contains: 'Nuevo → Tasado' } },
    })
    expect(transitions).toBe(1)
  })

  it('re-tasar un vehículo ya TASADO: nueva Valuation, sin transición', async () => {
    const f = await seed({ status: 'TASADO' })
    const res = await official(f, prismaA)
    expect(res.outcome).toBe('COMPLETADA')
    expect(res.transitioned).toBe(false)
    const st = await state(f.vehicleId)
    expect(st.status).toBe('TASADO')
    expect(st.valuations).toBe(1)
  })

  it('rollback total: Activity con actor inexistente → ni Valuation ni cambio de estado', async () => {
    const f = await seed()
    const err = await official(f, prismaA, { actorId: 'usuario-inexistente' }).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(isValuationError(err)).toBe(false)
    const st = await state(f.vehicleId)
    expect(st.status).toBe('NUEVO')
    expect(st.valuations).toBe(0)
    expect(st.attempts).toBe(0)
    expect(st.hasOfficialPrice).toBe(false)
  })
})

describe('officialValuationTx · auto sin datos', () => {
  it('marca/modelo sin comparables ni referencia → intento OFICIAL SIN_REFERENCIA sin tocar el vehículo', async () => {
    const f = await seed({ brand: `NoBrand_${uniqueSuffix()}`, model: `NoModel_${uniqueSuffix()}` })
    const res = await official(f, prismaA, {
      mode: {
        kind: 'AUTO',
        input: {
          brand: (await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })).brand,
          model: (await prismaA.vehicle.findUniqueOrThrow({ where: { id: f.vehicleId } })).model,
          type: 'AUTOCARAVANA',
          year: 2020,
          km: 1000,
          conservationState: 'BUENO',
          equipment: {},
        },
      },
    })
    expect(res.outcome).toBe('SIN_REFERENCIA')
    expect(res.transitioned).toBe(false)
    const st = await state(f.vehicleId)
    expect(st.status).toBe('NUEVO')
    expect(st.valuations).toBe(0)
    expect(st.attempts).toBe(1) // el intento SIN_REFERENCIA sí se persiste
    expect(st.hasOfficialPrice).toBe(false)
    const attempt = await prismaA.vehicleValuationAttempt.findFirstOrThrow({
      where: { vehicleId: f.vehicleId },
    })
    expect(attempt.outcome).toBe('SIN_REFERENCIA')
    expect(attempt.purpose).toBe('OFICIAL')
  })
})

describe('officialValuationTx · concurrencia', () => {
  it('dos tasaciones concurrentes: se serializan, exactamente UNA transición NUEVO→TASADO', async () => {
    const f = await seed()
    const aLocked = barrier()
    const releaseA = barrier()
    const a = official(f, prismaA, {
      hooks: {
        beforeWrite: async () => {
          aLocked.open()
          await releaseA.wait
        },
      },
    }).catch((e) => e)
    await aLocked.wait
    const b = official(f, prismaB).catch((e) => e)
    await waitUntilBlocked()
    releaseA.open()
    const aRes = await a
    const bRes = await b
    expect(aRes).not.toBeInstanceOf(Error)
    expect(bRes).not.toBeInstanceOf(Error)
    // Ambas registran una tasación oficial (append-only); solo la primera transiciona.
    const st = await state(f.vehicleId)
    expect(st.status).toBe('TASADO')
    expect(st.valuations).toBe(2)
    const transitions = await prismaA.activity.count({
      where: { sellerLeadId: f.sellerId, content: { contains: 'Nuevo → Tasado' } },
    })
    expect(transitions).toBe(1)
  })

  it('lock timeout: la segunda no escribe nada', async () => {
    const f = await seed()
    const held = barrier()
    const release = barrier()
    const holder = official(f, prismaA, {
      hooks: {
        beforeWrite: async () => {
          held.open()
          await release.wait
        },
      },
    })
    await held.wait
    const err = await official(f, prismaB, { lockTimeoutMs: 250 }).catch((e) => e)
    expect(err).toBeInstanceOf(LockError)
    release.open()
    await holder
    const st = await state(f.vehicleId)
    expect(st.valuations).toBe(1)
  })
})

describe('officialValuationTx · idempotencia (clave explícita)', () => {
  it('reintento SECUENCIAL con la misma clave → un solo Attempt/Valuation/transición; devuelve el existente', async () => {
    const f = await seed()
    const key = `idem_${uniqueSuffix()}`
    const r1 = await official(f, prismaA, { idempotencyKey: key })
    const r2 = await official(f, prismaA, { idempotencyKey: key })
    expect(r1.outcome).toBe('COMPLETADA')
    expect(r1.transitioned).toBe(true)
    // El reintento devuelve el MISMO intento y NO re-transiciona ni duplica.
    expect(r2.outcome).toBe('COMPLETADA')
    expect(r2.transitioned).toBe(false)
    expect(r2.attemptId).toBe(r1.attemptId)
    expect(r2.valuationId).toBe(r1.valuationId)
    const st = await state(f.vehicleId)
    expect(st.valuations).toBe(1)
    expect(st.attempts).toBe(1)
    const transitions = await prismaA.activity.count({
      where: { sellerLeadId: f.sellerId, content: { contains: 'Nuevo → Tasado' } },
    })
    expect(transitions).toBe(1)
  })

  it('clave NUEVA → intento independiente (dos Valuations, una sola transición)', async () => {
    const f = await seed()
    const r1 = await official(f, prismaA, { idempotencyKey: `k1_${uniqueSuffix()}` })
    const r2 = await official(f, prismaA, { idempotencyKey: `k2_${uniqueSuffix()}` })
    expect(r1.transitioned).toBe(true)
    expect(r2.transitioned).toBe(false) // ya TASADO tras la primera
    expect(r2.attemptId).not.toBe(r1.attemptId)
    const st = await state(f.vehicleId)
    expect(st.valuations).toBe(2)
    expect(st.attempts).toBe(2)
  })

  it('doble submit CONCURRENTE con la misma clave → exactamente UN intento/Valuation/transición', async () => {
    const f = await seed()
    const key = `idem_${uniqueSuffix()}`
    const aLocked = barrier()
    const releaseA = barrier()
    const a = official(f, prismaA, {
      idempotencyKey: key,
      hooks: {
        beforeWrite: async () => {
          aLocked.open()
          await releaseA.wait
        },
      },
    }).catch((e) => e)
    await aLocked.wait
    const b = official(f, prismaB, { idempotencyKey: key }).catch((e) => e)
    await waitUntilBlocked()
    releaseA.open()
    const aRes = await a
    const bRes = await b
    expect(aRes).not.toBeInstanceOf(Error)
    expect(bRes).not.toBeInstanceOf(Error)
    // B se serializa tras A; su paso 0 (bajo el lock) encuentra el intento de A y lo devuelve.
    expect(aRes.transitioned).toBe(true)
    expect(bRes.transitioned).toBe(false)
    expect(bRes.attemptId).toBe(aRes.attemptId)
    const st = await state(f.vehicleId)
    expect(st.valuations).toBe(1)
    expect(st.attempts).toBe(1)
    const transitions = await prismaA.activity.count({
      where: { sellerLeadId: f.sellerId, content: { contains: 'Nuevo → Tasado' } },
    })
    expect(transitions).toBe(1)
  })

  it('un rechazo del gate NO consume la clave: reintento con la misma clave tras corregir el gate', async () => {
    const f = await seed({ inspectionCompleted: false })
    const key = `idem_${uniqueSuffix()}`
    const err = await official(f, prismaA, { idempotencyKey: key }).catch((e) => e)
    expect(codeOf(err)).toBe('INSPECTION_NOT_COMPLETED')
    // Corrige el gate y reintenta con la MISMA clave: la clave seguía libre (no se escribió intento).
    await prismaA.workOrder.create({
      data: {
        vehicleId: f.vehicleId,
        kind: 'INSPECCION_ENTRADA',
        status: 'COMPLETADA',
        description: 'Inspección de entrada',
      },
    })
    const res = await official(f, prismaA, { idempotencyKey: key })
    expect(res.outcome).toBe('COMPLETADA')
    expect(res.transitioned).toBe(true)
    const st = await state(f.vehicleId)
    expect(st.attempts).toBe(1)
  })

  it('intento FALLO_TECNICO previo de la MISMA petición → VALUATION_ATTEMPT_FAILED (clave consumida, vehículo intacto)', async () => {
    const f = await seed()
    const key = `idem_${uniqueSuffix()}`
    // Simula el registro de fallo técnico que hace el server action AUTO FUERA de la transacción:
    // debe llevar la huella de la MISMA petición (AUTO) para que el reintento se reconozca como tal.
    const autoFingerprint = officialRequestFingerprint({
      vehicleId: f.vehicleId,
      mode: { kind: 'AUTO' },
    })
    await prismaA.vehicleValuationAttempt.create({
      data: {
        vehicleId: f.vehicleId,
        purpose: 'OFICIAL',
        outcome: 'FALLO_TECNICO',
        method: 'AUTO',
        errorCode: 'X',
        createdById: f.userId,
        idempotencyKey: key,
        requestFingerprint: autoFingerprint,
      },
    })
    // Reintento de la MISMA petición (AUTO, misma clave) → falla consumida.
    const err = await official(f, prismaA, { idempotencyKey: key, mode: AUTO }).catch((e) => e)
    expect(codeOf(err)).toBe('VALUATION_ATTEMPT_FAILED')
    const st = await state(f.vehicleId)
    expect(st.status).toBe('NUEVO')
    expect(st.valuations).toBe(0)
    expect(st.attempts).toBe(1) // solo el fallo previo
  })

  it('FALLO_TECNICO previo pero OTRA petición (misma clave) → reutilización incompatible', async () => {
    const f = await seed()
    const key = `idem_${uniqueSuffix()}`
    const autoFingerprint = officialRequestFingerprint({
      vehicleId: f.vehicleId,
      mode: { kind: 'AUTO' },
    })
    await prismaA.vehicleValuationAttempt.create({
      data: {
        vehicleId: f.vehicleId,
        purpose: 'OFICIAL',
        outcome: 'FALLO_TECNICO',
        method: 'AUTO',
        errorCode: 'X',
        createdById: f.userId,
        idempotencyKey: key,
        requestFingerprint: autoFingerprint,
      },
    })
    // Reintento con la misma clave pero MANUAL (otra petición) → reutilización, no "fallo".
    const err = await official(f, prismaA, { idempotencyKey: key, mode: MANUAL }).catch((e) => e)
    expect(codeOf(err)).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST')
  })

  it('unique index: rechaza dos claves iguales (P2002) y admite múltiples NULL (preliminares)', async () => {
    const f = await seed()
    const key = `idem_${uniqueSuffix()}`
    await prismaA.vehicleValuationAttempt.create({
      data: {
        vehicleId: f.vehicleId,
        purpose: 'OFICIAL',
        outcome: 'COMPLETADA',
        method: 'MANUAL',
        createdById: f.userId,
        idempotencyKey: key,
      },
    })
    await expect(
      prismaA.vehicleValuationAttempt.create({
        data: {
          vehicleId: f.vehicleId,
          purpose: 'OFICIAL',
          outcome: 'COMPLETADA',
          method: 'MANUAL',
          createdById: f.userId,
          idempotencyKey: key,
        },
      })
    ).rejects.toMatchObject({ code: 'P2002' })
    // Dos intentos PRELIMINAR sin clave conviven (NULL múltiple permitido por el unique parcial).
    for (let i = 0; i < 2; i++) {
      await prismaA.vehicleValuationAttempt.create({
        data: {
          vehicleId: f.vehicleId,
          purpose: 'PRELIMINAR',
          outcome: 'COMPLETADA',
          method: 'AUTO',
          createdById: f.userId,
        },
      })
    }
    const nulls = await prismaA.vehicleValuationAttempt.count({
      where: { vehicleId: f.vehicleId, idempotencyKey: null },
    })
    expect(nulls).toBe(2)
  })
})

describe('officialValuationTx · idempotencia VINCULADA a la petición', () => {
  const codeOfBind = codeOf

  it('misma clave + mismo payload (whitespace irrelevante) → replay idempotente', async () => {
    const f = await seed()
    const key = `idem_${uniqueSuffix()}`
    const r1 = await official(f, prismaA, { idempotencyKey: key, mode: MANUAL })
    // Mismo payload salvo espacios en el motivo → misma huella → mismo intento.
    const r2 = await official(f, prismaA, {
      idempotencyKey: key,
      mode: { ...MANUAL, reason: '  Tras inspección  ' },
    })
    expect(r1.transitioned).toBe(true)
    expect(r2.transitioned).toBe(false)
    expect(r2.attemptId).toBe(r1.attemptId)
    const st = await state(f.vehicleId)
    expect(st.valuations).toBe(1)
    expect(st.attempts).toBe(1)
  })

  it('misma clave + OTRO vehículo → IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST; cero escritura en el 2.º', async () => {
    const f1 = await seed()
    const f2 = await seed()
    const key = `idem_${uniqueSuffix()}`
    const r1 = await official(f1, prismaA, { idempotencyKey: key })
    expect(r1.outcome).toBe('COMPLETADA')
    const err = await official(f2, prismaA, { idempotencyKey: key }).catch((e) => e)
    expect(codeOfBind(err)).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST')
    const st2 = await state(f2.vehicleId)
    expect(st2.valuations).toBe(0)
    expect(st2.attempts).toBe(0)
    expect(st2.status).toBe('NUEVO')
  })

  it('misma clave + AUTO después de MANUAL → rechazo', async () => {
    const f = await seed()
    const key = `idem_${uniqueSuffix()}`
    await official(f, prismaA, { idempotencyKey: key, mode: MANUAL })
    const err = await official(f, prismaA, { idempotencyKey: key, mode: AUTO }).catch((e) => e)
    expect(codeOfBind(err)).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST')
    expect((await state(f.vehicleId)).attempts).toBe(1)
  })

  it('misma clave + MANUAL después de AUTO → rechazo', async () => {
    const f = await seed()
    const key = `idem_${uniqueSuffix()}`
    // AUTO sin reference_prices en la BD de test → SIN_REFERENCIA, pero registra el intento con la clave.
    await official(f, prismaA, { idempotencyKey: key, mode: AUTO })
    const err = await official(f, prismaA, { idempotencyKey: key, mode: MANUAL }).catch((e) => e)
    expect(codeOfBind(err)).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST')
  })

  it.each([
    ['rango distinto', { ...MANUAL, recommended: 12500 } as OfficialValuationMode],
    ['confianza distinta', { ...MANUAL, confidence: 'ALTA' } as OfficialValuationMode],
    ['motivo distinto', { ...MANUAL, reason: 'Otro motivo' } as OfficialValuationMode],
  ])('misma clave + %s → rechazo', async (_label, mode2) => {
    const f = await seed()
    const key = `idem_${uniqueSuffix()}`
    await official(f, prismaA, { idempotencyKey: key, mode: MANUAL })
    const err = await official(f, prismaA, { idempotencyKey: key, mode: mode2 }).catch((e) => e)
    expect(codeOfBind(err)).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST')
    // El segundo intento no se escribe: sigue habiendo un único Attempt/Valuation.
    const st = await state(f.vehicleId)
    expect(st.attempts).toBe(1)
    expect(st.valuations).toBe(1)
  })

  it('concurrente: misma clave + payload DISTINTO → exactamente una válida; la otra, reutilización; sin 500', async () => {
    const f = await seed()
    const key = `idem_${uniqueSuffix()}`
    const aLocked = barrier()
    const releaseA = barrier()
    const a = official(f, prismaA, {
      idempotencyKey: key,
      mode: MANUAL,
      hooks: {
        beforeWrite: async () => {
          aLocked.open()
          await releaseA.wait
        },
      },
    }).catch((e) => e)
    await aLocked.wait
    // B, misma clave, payload distinto (otro rango). Contiende por el lock del MISMO vehículo.
    const b = official(f, prismaB, {
      idempotencyKey: key,
      mode: { ...MANUAL, recommended: 13000 },
    }).catch((e) => e)
    await waitUntilBlocked()
    releaseA.open()
    const aRes = await a
    const bRes = await b
    expect(aRes).not.toBeInstanceOf(Error)
    // B, ya serializado tras A, ve el intento de A con huella distinta → reutilización incompatible.
    expect(codeOfBind(bRes)).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST')
    const st = await state(f.vehicleId)
    expect(st.valuations).toBe(1)
    expect(st.attempts).toBe(1)
  })
})
