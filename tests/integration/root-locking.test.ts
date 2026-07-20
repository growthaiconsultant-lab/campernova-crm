/**
 * Tests de integración con PostgreSQL REAL (PR I1) — coordinación de locks de filas raíz.
 *
 * Demuestran sobre una base efímera que el helper hace lo que promete: bloquea de verdad la fila,
 * espera o corta con `LOCK_TIMEOUT`, no interfiere entre raíces distintas, normaliza el orden,
 * revierte en caso de error, aborta si la raíz no existe y no deja los timeouts pegados a la
 * conexión.
 *
 * El solapamiento se fuerza con BARRERAS deterministas (promesas que se resuelven a mano) y DOS
 * conexiones independientes. No se usan `sleep` como mecanismo de sincronización: solo aparecen
 * como cota superior en la carrera de `LOCK_TIMEOUT`, donde el fallo esperado lo produce
 * PostgreSQL, no el reloj del test.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { LockError, withLockedRoots, type LockRoot } from '@/lib/locking'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prismaA: PrismaClient
let prismaB: PrismaClient
const cleanups: Array<() => Promise<void>> = []

/** Barrera explícita: `wait` no avanza hasta que alguien llama a `open`. */
function barrier() {
  let open!: () => void
  const wait = new Promise<void>((resolve) => {
    open = resolve
  })
  return { wait, open }
}

async function seedSeller(): Promise<{ sellerId: string; vehicleId: string }> {
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
      status: 'PUBLICADO',
    },
  })
  cleanups.push(async () => {
    await prismaA.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prismaA.sellerLead.deleteMany({ where: { id: seller.id } })
  })
  return { sellerId: seller.id, vehicleId: vehicle.id }
}

async function seedBuyer(): Promise<string> {
  const s = uniqueSuffix()
  const buyer = await prismaA.buyerLead.create({
    data: { name: `B ${s}`, email: `b_${s}@integ.test`, phone: '600000001' },
  })
  cleanups.push(async () => {
    await prismaA.buyerLead.deleteMany({ where: { id: buyer.id } })
  })
  return buyer.id
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

describe('el lock es real', () => {
  it('una segunda transacción no entra mientras la primera retiene la raíz', async () => {
    const { vehicleId } = await seedSeller()
    const root: LockRoot[] = [{ type: 'vehicle', id: vehicleId }]

    const aHoldsTheLock = barrier()
    const releaseA = barrier()
    let bEnteredWhileAHeld = false

    const a = withLockedRoots(
      root,
      async () => {
        aHoldsTheLock.open()
        await releaseA.wait
        return 'A'
      },
      { client: prismaA }
    )

    await aHoldsTheLock.wait // A tiene el lock, garantizado por barrera.

    const b = withLockedRoots(
      root,
      async () => {
        bEnteredWhileAHeld = true
        return 'B'
      },
      { client: prismaB, lockTimeoutMs: 10_000 }
    )

    // Cede el bucle de eventos varias veces: si el lock no funcionara, B ya habría entrado.
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r))
    expect(bEnteredWhileAHeld).toBe(false)

    releaseA.open()
    expect(await a).toBe('A')
    expect(await b).toBe('B')
    expect(bEnteredWhileAHeld).toBe(true)
  })

  it('si el lock sigue ocupado se corta con LOCK_TIMEOUT, no espera indefinidamente', async () => {
    const { vehicleId } = await seedSeller()
    const root: LockRoot[] = [{ type: 'vehicle', id: vehicleId }]

    const aHoldsTheLock = barrier()
    const releaseA = barrier()

    const a = withLockedRoots(
      root,
      async () => {
        aHoldsTheLock.open()
        await releaseA.wait
        return 'A'
      },
      { client: prismaA }
    )
    await aHoldsTheLock.wait

    const operation = async () => 'B'
    const result = await withLockedRoots(root, operation, {
      client: prismaB,
      lockTimeoutMs: 300,
    }).catch((err) => err)

    releaseA.open()
    await a

    expect(result).toBeInstanceOf(LockError)
    expect((result as LockError).code).toBe('LOCK_TIMEOUT')
  })

  it('raíces distintas no se estorban', async () => {
    const first = await seedSeller()
    const second = await seedSeller()

    const aHoldsTheLock = barrier()
    const releaseA = barrier()

    const a = withLockedRoots(
      [{ type: 'vehicle', id: first.vehicleId }],
      async () => {
        aHoldsTheLock.open()
        await releaseA.wait
        return 'A'
      },
      { client: prismaA }
    )
    await aHoldsTheLock.wait

    // Vehículo distinto: entra sin esperar aunque A siga dentro.
    const b = await withLockedRoots([{ type: 'vehicle', id: second.vehicleId }], async () => 'B', {
      client: prismaB,
      lockTimeoutMs: 1_000,
    })
    expect(b).toBe('B')

    releaseA.open()
    expect(await a).toBe('A')
  })
})

describe('orden normalizado', () => {
  it('dos operaciones con las mismas raíces en orden inverso terminan sin deadlock', async () => {
    const { sellerId, vehicleId } = await seedSeller()
    const buyerId = await seedBuyer()

    const enOrden: LockRoot[] = [
      { type: 'vehicle', id: vehicleId },
      { type: 'sellerLead', id: sellerId },
      { type: 'buyerLead', id: buyerId },
    ]
    const alReves: LockRoot[] = [...enOrden].reverse()

    // Sin normalización esto es el patrón clásico de deadlock; con ella, ambas serializan.
    const [x, y] = await Promise.all([
      withLockedRoots(enOrden, async () => 'x', { client: prismaA, lockTimeoutMs: 5_000 }),
      withLockedRoots(alReves, async () => 'y', { client: prismaB, lockTimeoutMs: 5_000 }),
    ])

    expect([x, y]).toEqual(['x', 'y'])
  })

  it('acepta las tres raíces a la vez y ejecuta la operación', async () => {
    const { sellerId, vehicleId } = await seedSeller()
    const buyerId = await seedBuyer()

    const result = await withLockedRoots(
      [
        { type: 'buyerLead', id: buyerId },
        { type: 'vehicle', id: vehicleId },
        { type: 'sellerLead', id: sellerId },
      ],
      async (tx) => tx.vehicle.count({ where: { id: vehicleId } }),
      { client: prismaA }
    )
    expect(result).toBe(1)
  })
})

describe('transacción', () => {
  it('una excepción de la operación revierte la escritura', async () => {
    const { vehicleId } = await seedSeller()
    class FalloDeNegocio extends Error {}

    await expect(
      withLockedRoots(
        [{ type: 'vehicle', id: vehicleId }],
        async (tx) => {
          await tx.vehicle.update({ where: { id: vehicleId }, data: { km: 999_999 } })
          throw new FalloDeNegocio('aborta')
        },
        { client: prismaA }
      )
    ).rejects.toBeInstanceOf(FalloDeNegocio)

    const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })
    expect(vehicle.km).toBe(1000)
  })

  it('la escritura persiste si la operación termina bien', async () => {
    const { vehicleId } = await seedSeller()

    await withLockedRoots(
      [{ type: 'vehicle', id: vehicleId }],
      async (tx) => tx.vehicle.update({ where: { id: vehicleId }, data: { km: 2000 } }),
      { client: prismaA }
    )

    const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })
    expect(vehicle.km).toBe(2000)
  })

  it('raíz inexistente: no ejecuta la operación ni deja efectos', async () => {
    const { vehicleId } = await seedSeller()
    let ejecutada = false

    const err = await withLockedRoots(
      [
        { type: 'vehicle', id: vehicleId },
        { type: 'buyerLead', id: 'no-existe-en-absoluto' },
      ],
      async (tx) => {
        ejecutada = true
        return tx.vehicle.update({ where: { id: vehicleId }, data: { km: 555 } })
      },
      { client: prismaA }
    ).catch((e) => e)

    expect(err).toBeInstanceOf(LockError)
    expect((err as LockError).code).toBe('ROOT_NOT_FOUND')
    expect(ejecutada).toBe(false)

    const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })
    expect(vehicle.km).toBe(1000)
  })

  it('sin raíces sigue habiendo transacción y la operación se ejecuta', async () => {
    const { vehicleId } = await seedSeller()
    const count = await withLockedRoots(
      [],
      async (tx) => tx.vehicle.count({ where: { id: vehicleId } }),
      {
        client: prismaA,
      }
    )
    expect(count).toBe(1)
  })
})

describe('SET LOCAL no se escapa de la transacción', () => {
  it('los timeouts no persisten en la conexión después de terminar', async () => {
    const { vehicleId } = await seedSeller()

    await withLockedRoots([{ type: 'vehicle', id: vehicleId }], async () => 'ok', {
      client: prismaA,
      lockTimeoutMs: 250,
      statementTimeoutMs: 500,
    })

    // Fuera de la transacción deben volver a ser los valores de la sesión, no los del helper.
    const rows = await prismaA.$queryRaw<
      Array<{ lock_timeout: string; statement_timeout: string }>
    >`
      SELECT current_setting('lock_timeout') AS lock_timeout,
             current_setting('statement_timeout') AS statement_timeout
    `
    expect(rows[0].lock_timeout).not.toBe('250ms')
    expect(rows[0].statement_timeout).not.toBe('500ms')
  })
})

describe('deadlock de control', () => {
  // Demuestra que el patrón que el orden global evita es real: dos transacciones que adquieren
  // las MISMAS filas en sentido contrario, saltándose el helper a propósito, producen 40P01.
  // No existe código de producción que permita esto; se construye a mano solo aquí.
  it('adquirir en orden inverso sin el helper provoca 40P01', async () => {
    const first = await seedSeller()
    const second = await seedSeller()

    const aFirstLock = barrier()
    const bFirstLock = barrier()

    const a = prismaA.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL lock_timeout = 5000`
      await tx.$queryRaw`SELECT id FROM "vehicles" WHERE id = ${first.vehicleId} FOR UPDATE`
      aFirstLock.open()
      await bFirstLock.wait
      await tx.$queryRaw`SELECT id FROM "vehicles" WHERE id = ${second.vehicleId} FOR UPDATE`
      return 'a'
    })

    const b = prismaB.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL lock_timeout = 5000`
      await tx.$queryRaw`SELECT id FROM "vehicles" WHERE id = ${second.vehicleId} FOR UPDATE`
      bFirstLock.open()
      await aFirstLock.wait
      await tx.$queryRaw`SELECT id FROM "vehicles" WHERE id = ${first.vehicleId} FOR UPDATE`
      return 'b'
    })

    const results = await Promise.allSettled([a, b])
    const rejected = results.filter((r) => r.status === 'rejected')

    // PostgreSQL aborta una de las dos; la otra completa.
    expect(rejected).toHaveLength(1)
    const reason = (rejected[0] as PromiseRejectedResult).reason
    expect(JSON.stringify(reason?.message ?? reason)).toMatch(/40P01|deadlock/i)
  })

  it('las mismas dos raíces a través del helper no producen deadlock', async () => {
    const first = await seedSeller()
    const second = await seedSeller()

    const roots: LockRoot[] = [
      { type: 'vehicle', id: first.vehicleId },
      { type: 'vehicle', id: second.vehicleId },
    ]

    const [x, y] = await Promise.all([
      withLockedRoots(roots, async () => 'x', { client: prismaA, lockTimeoutMs: 5_000 }),
      withLockedRoots([...roots].reverse(), async () => 'y', {
        client: prismaB,
        lockTimeoutMs: 5_000,
      }),
    ])
    expect([x, y]).toEqual(['x', 'y'])
  })
})
