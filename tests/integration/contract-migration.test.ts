/**
 * Tests de integración con PostgreSQL REAL (PR I3C1B) — seguridad de la migración contract
 * `SET NOT NULL` sobre `deliveries.offer_id`.
 *
 * `I3C1B REQUIRES ZERO NULL offer_id ROWS BEFORE REMOTE APPLICATION`
 *
 * Se ejerce la SQL EXACTA de la migración (leída del fichero) contra una tabla `deliveries` clonada
 * con `LIKE public.deliveries INCLUDING ALL` en un esquema efímero, puesta en estado I3C1A
 * (`offer_id` nullable). Nunca se toca la tabla `public.deliveries` compartida.
 *
 * La migración es una única sentencia y Prisma aplica cada migración dentro de una transacción; por
 * eso aquí se envuelve la SQL exacta en una transacción interactiva de Prisma: si falla, PostgreSQL
 * revierte el DDL por completo (nullability y filas intactas) y la migración NO puede quedar
 * registrada como finalizada ni aplicada a medias.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let db: PrismaClient

const CONTRACT_SQL = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20260721200000_make_delivery_offer_link_required/migration.sql'
  ),
  'utf8'
)

beforeAll(() => {
  db = createGuardedTestPrisma()
})

afterAll(async () => {
  await db?.$disconnect()
})

/** Nullability de una columna en un esquema dado: 'YES' | 'NO'. */
async function offerIdNullability(schema: string): Promise<string> {
  const rows = await db.$queryRawUnsafe<Array<{ is_nullable: string }>>(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'deliveries' AND column_name = 'offer_id'`,
    schema
  )
  return rows[0]?.is_nullable ?? 'MISSING'
}

/** Nº de filas de la tabla clonada. */
async function deliveryCount(schema: string): Promise<number> {
  const rows = await db.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n FROM "${schema}"."deliveries"`
  )
  return rows[0]?.n ?? -1
}

/** Inserta una fila en la tabla clonada; `offerId` puede ser NULL. Devuelve el id. */
async function insertDelivery(schema: string, offerId: string | null): Promise<string> {
  const id = `d_${uniqueSuffix()}`
  await db.$executeRawUnsafe(
    `INSERT INTO "${schema}"."deliveries"
       ("id","vehicle_id","buyer_lead_id","offer_id","scheduled_at","status","created_at","updated_at")
     VALUES ($1, $2, $3, $4, now(), 'PROGRAMADA'::"public"."DeliveryStatus", now(), now())`,
    id,
    `veh_${id}`,
    `buy_${id}`,
    offerId
  )
  return id
}

/** ¿Existe el índice único parcial clonado (por definición, no por nombre)? */
async function hasPartialUniqueIndex(schema: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n
     FROM pg_indexes
     WHERE schemaname = $1 AND tablename = 'deliveries'
       AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%WHERE%'`,
    schema
  )
  return (rows[0]?.n ?? 0) > 0
}

/**
 * Crea un esquema efímero con `deliveries` clonada (LIKE INCLUDING ALL) y puesta en estado I3C1A
 * (offer_id nullable). Ejecuta `fn` y siempre destruye el esquema. Nunca toca public.deliveries.
 */
async function withEphemeralDeliveries<T>(fn: (schema: string) => Promise<T>): Promise<T> {
  const schema = `i3c1b_${uniqueSuffix()}`
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
  try {
    await db.$executeRawUnsafe(
      `CREATE TABLE "${schema}"."deliveries" (LIKE "public"."deliveries" INCLUDING ALL)`
    )
    // Estado I3C1A: la columna vuelve a ser nullable (el clon parte del contract ya aplicado).
    await db.$executeRawUnsafe(
      `ALTER TABLE "${schema}"."deliveries" ALTER COLUMN "offer_id" DROP NOT NULL`
    )
    return await fn(schema)
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
  }
}

/**
 * Aplica la SQL EXACTA de la migración contract sobre el esquema efímero, dentro de una transacción
 * interactiva (como hace Prisma con cada migración). Devuelve el error si PostgreSQL la rechaza.
 */
async function applyContract(schema: string): Promise<unknown | null> {
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}", public`)
      await tx.$executeRawUnsafe(CONTRACT_SQL)
    })
    return null
  } catch (e) {
    return e
  }
}

describe('migración contract con datos limpios', () => {
  it('cero nulls: SET NOT NULL tiene éxito, la fila válida permanece y el índice parcial sigue', async () => {
    await withEphemeralDeliveries(async (schema) => {
      expect(await offerIdNullability(schema)).toBe('YES') // estado I3C1A
      const id = await insertDelivery(schema, `offer_${uniqueSuffix()}`)
      expect(await deliveryCount(schema)).toBe(1)
      expect(await hasPartialUniqueIndex(schema)).toBe(true)

      const err = await applyContract(schema)
      expect(err).toBeNull()

      // offer_id pasa a NOT NULL; la fila válida permanece intacta; el índice parcial persiste.
      expect(await offerIdNullability(schema)).toBe('NO')
      expect(await deliveryCount(schema)).toBe(1)
      const rows = await db.$queryRawUnsafe<Array<{ id: string; offer_id: string | null }>>(
        `SELECT "id","offer_id" FROM "${schema}"."deliveries" WHERE "id" = $1`,
        id
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].offer_id).not.toBeNull()
      expect(await hasPartialUniqueIndex(schema)).toBe(true)
    })
  })
})

describe('migración contract con un offer_id NULL existente (prueba negativa obligatoria)', () => {
  it('PostgreSQL rechaza SET NOT NULL; la fila NULL permanece; la columna sigue nullable; sin aplicación parcial', async () => {
    await withEphemeralDeliveries(async (schema) => {
      // Fixture negativo deliberado: una Delivery con offer_id = NULL (solo posible en estado I3C1A).
      const nullId = await insertDelivery(schema, null)
      const validId = await insertDelivery(schema, `offer_${uniqueSuffix()}`)
      expect(await deliveryCount(schema)).toBe(2)

      const err = await applyContract(schema)

      // Error NOT NULL real y observable (23502), sin exponer nada sensible.
      expect(err).toBeInstanceOf(Error)
      expect(String((err as Error).message).toLowerCase()).toMatch(/null|23502/)

      // La columna sigue nullable (el DDL se revirtió por completo): sin aplicación parcial.
      expect(await offerIdNullability(schema)).toBe('YES')

      // Ninguna fila modificada ni eliminada; sin backfill.
      expect(await deliveryCount(schema)).toBe(2)
      const nullRow = await db.$queryRawUnsafe<Array<{ offer_id: string | null }>>(
        `SELECT "offer_id" FROM "${schema}"."deliveries" WHERE "id" = $1`,
        nullId
      )
      expect(nullRow).toHaveLength(1)
      expect(nullRow[0].offer_id).toBeNull()
      const validRow = await db.$queryRawUnsafe<Array<{ offer_id: string | null }>>(
        `SELECT "offer_id" FROM "${schema}"."deliveries" WHERE "id" = $1`,
        validId
      )
      expect(validRow).toHaveLength(1)
      expect(validRow[0].offer_id).not.toBeNull()
    })
  })
})
