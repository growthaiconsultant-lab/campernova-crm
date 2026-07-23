/**
 * Tests de integración con PostgreSQL 17 REAL (PR I3C1B) — comportamiento REAL de `prisma migrate
 * deploy` cuando la migración contract `SET NOT NULL` encuentra una fila con `offer_id = NULL`.
 *
 * `I3C1B FAILURE WITH NULL DATA WAS VERIFIED USING REAL prisma migrate deploy`
 * `A FAILED I3C1B CONTRACT MIGRATION LEAVES THE OBSERVED _prisma_migrations STATE DOCUMENTED`
 *
 * A diferencia de `contract-migration.test.ts` (atomicidad DDL de PostgreSQL sobre una tabla
 * clonada), aquí se ejercita el PROCESO real que se usará en staging/producción:
 *   1. base de datos EFÍMERA INDEPENDIENTE creada en el mismo servidor (nunca la compartida);
 *   2. `prisma migrate deploy` real aplica las 5 primeras migraciones (directorio temporal, bytes y
 *      checksums intactos);
 *   3. se inserta una Delivery con `offer_id = NULL` (estado expand, columna nullable);
 *   4. se añade la 6ª migración versionada y `prisma migrate deploy` la intenta → falla;
 *   5. se observa exit code, `_prisma_migrations`, schema y datos; y un segundo deploy bloqueado.
 *
 * No usa staging ni producción; el guard valida que la URL base es efímera. La base temporal se
 * destruye siempre en afterAll, aunque quede un intento de migración fallido activo.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { requireTestDatabaseUrl } from './guard'
import { uniqueSuffix } from './db'

const CONTRACT_MIGRATION = '20260721200000_make_delivery_offer_link_required'
const REPO_MIGRATIONS = join(process.cwd(), 'prisma', 'migrations')

const DATASOURCE_SCHEMA = `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
`

/* eslint-disable @typescript-eslint/no-explicit-any */
type DeployResult = { code: number; out: string; err: string }
type MigrationRow = {
  migration_name: string
  finished_at: Date | null
  rolled_back_at: Date | null
  applied_steps_count: number
  has_logs: boolean
}

let baseUrl: URL
let tempDb: string
let tempUrl: string
let workDir: string
let migDir: string
let schemaPath: string
let firstFive: string[]

const cap: {
  setupError: string | null
  deploy5Code: number
  offerIdNullableAfter5: string
  fkAfter5: boolean
  normalIdxAfter5: boolean
  partialIdxAfter5: boolean
  fifthApplied: boolean
  sixthPresentAfter5: boolean
  preflightPassCode: number
  nullCountBeforeContract: number
  preflightFailCode: number
  deployContract: DeployResult
  offerIdNullableAfterFail: string
  nullRowIntact: boolean
  nullRowValueNull: boolean
  fkAfterFail: boolean
  normalIdxAfterFail: boolean
  partialIdxAfterFail: boolean
  migrationRow: MigrationRow | null
  secondDeploy: DeployResult
} = {
  setupError: null,
  deploy5Code: -1,
  offerIdNullableAfter5: '',
  fkAfter5: false,
  normalIdxAfter5: false,
  partialIdxAfter5: false,
  fifthApplied: false,
  sixthPresentAfter5: true,
  preflightPassCode: -1,
  nullCountBeforeContract: -1,
  preflightFailCode: -1,
  deployContract: { code: -1, out: '', err: '' },
  offerIdNullableAfterFail: '',
  nullRowIntact: false,
  nullRowValueNull: false,
  fkAfterFail: false,
  normalIdxAfterFail: false,
  partialIdxAfterFail: false,
  migrationRow: null,
  secondDeploy: { code: -1, out: '', err: '' },
}

function urlFor(db: string, withQuery: boolean): string {
  const u = new URL(baseUrl.toString())
  u.pathname = `/${db}`
  if (!withQuery) u.search = ''
  return u.toString()
}

function psql(db: string, sql: string): void {
  // psql no entiende el parámetro de query `schema`; se usa la URL sin query.
  execSync(`psql "${urlFor(db, false)}" -v ON_ERROR_STOP=1 -c ${JSON.stringify(sql)}`, {
    stdio: 'pipe',
  })
}

function deploy(): DeployResult {
  try {
    const out = execSync(`pnpm exec prisma migrate deploy --schema "${schemaPath}"`, {
      env: { ...process.env, DATABASE_URL: tempUrl, DIRECT_URL: tempUrl },
      stdio: 'pipe',
      encoding: 'utf8',
    })
    return { code: 0, out, err: '' }
  } catch (e: any) {
    return {
      code: typeof e.status === 'number' ? e.status : 1,
      out: e.stdout?.toString?.() ?? '',
      err: e.stderr?.toString?.() ?? '',
    }
  }
}

function runPreflight(expectNullable: boolean): number {
  try {
    execSync(`pnpm exec tsx scripts/check-delivery-offer-nulls.ts`, {
      env: {
        ...process.env,
        CHECK_DELIVERY_OFFER_NULLS: '1',
        CHECK_DELIVERY_OFFER_EXPECT_NULLABLE: expectNullable ? '1' : '0',
        REMOTE_MIGRATION_GUARD_ENV: 'production',
        REMOTE_MIGRATION_GUARD_DATABASE_URL: tempUrl,
        REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS: tempDb,
      },
      stdio: 'pipe',
      encoding: 'utf8',
    })
    return 0
  } catch (e: any) {
    return typeof e.status === 'number' ? e.status : 1
  }
}

async function withClient<T>(fn: (c: PrismaClient) => Promise<T>): Promise<T> {
  const c = new PrismaClient({ datasourceUrl: tempUrl })
  try {
    return await fn(c)
  } finally {
    await c.$disconnect().catch(() => {})
  }
}

async function offerIdNullable(c: PrismaClient): Promise<string> {
  const rows = await c.$queryRawUnsafe<Array<{ is_nullable: string }>>(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema='public' AND table_name='deliveries' AND column_name='offer_id'`
  )
  return rows[0]?.is_nullable ?? 'MISSING'
}
async function fkPresent(c: PrismaClient): Promise<boolean> {
  const rows = await c.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n FROM pg_constraint
     WHERE conname='deliveries_offer_id_fkey' AND contype='f' AND convalidated`
  )
  return (rows[0]?.n ?? 0) === 1
}
async function idxPresent(c: PrismaClient, name: string): Promise<boolean> {
  const rows = await c.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n FROM pg_indexes
     WHERE schemaname='public' AND tablename='deliveries' AND indexname=$1`,
    name
  )
  return (rows[0]?.n ?? 0) === 1
}

beforeAll(async () => {
  try {
    const testUrl = requireTestDatabaseUrl(process.env, { requireReset: true })
    baseUrl = new URL(testUrl)
    tempDb = `i3c1b_mig_${uniqueSuffix()}`
    tempUrl = urlFor(tempDb, true)

    // Migraciones locales: 6; las cinco primeras para el setup, la 6ª (contract) es la que falla.
    const all = readdirSync(REPO_MIGRATIONS, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
    firstFive = all.filter((n) => n !== CONTRACT_MIGRATION)
    if (firstFive.length !== 5 || !all.includes(CONTRACT_MIGRATION)) {
      throw new Error(`estructura de migraciones inesperada: ${all.join(',')}`)
    }

    // Directorio temporal de migraciones (bytes/checksum intactos) + schema datasource-only.
    workDir = join(process.cwd(), 'node_modules', `.i3c1b-deploy-${uniqueSuffix()}`)
    migDir = join(workDir, 'migrations')
    schemaPath = join(workDir, 'schema.prisma')
    mkdirSync(migDir, { recursive: true })
    copyFileSync(join(REPO_MIGRATIONS, 'migration_lock.toml'), join(migDir, 'migration_lock.toml'))
    for (const f of firstFive)
      cpSync(join(REPO_MIGRATIONS, f), join(migDir, f), { recursive: true })
    writeFileSync(schemaPath, DATASOURCE_SCHEMA)

    // Base efímera INDEPENDIENTE en el mismo servidor (nunca la compartida).
    psql('postgres', `CREATE DATABASE "${tempDb}"`)

    // (1) Aplica las 5 primeras migraciones con Prisma Migrate real.
    const d5 = deploy()
    cap.deploy5Code = d5.code
    if (d5.code !== 0) throw new Error(`el deploy de 5 migraciones falló: ${d5.err || d5.out}`)

    // (2) Verifica estado expand.
    await withClient(async (c) => {
      cap.offerIdNullableAfter5 = await offerIdNullable(c)
      cap.fkAfter5 = await fkPresent(c)
      cap.normalIdxAfter5 = await idxPresent(c, 'deliveries_offer_id_idx')
      cap.partialIdxAfter5 = await idxPresent(c, 'deliveries_active_vehicle_key')
      const mig = await c.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name=$1 AND finished_at IS NOT NULL`,
        firstFive[firstFive.length - 1]
      )
      cap.fifthApplied = (mig[0]?.n ?? 0) === 1
      const sixth = await c.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name=$1`,
        CONTRACT_MIGRATION
      )
      cap.sixthPresentAfter5 = (sixth[0]?.n ?? 0) > 0
    })

    // (3) Preflight PASS: base sin deliveries, offer_id nullable, I3C1A aplicada, I3C1B no.
    cap.preflightPassCode = runPreflight(true)

    // (4) Fixtures mínimos + Delivery con offer_id = NULL (estado inválido deliberado).
    await withClient(async (c) => {
      const s = uniqueSuffix()
      const seller = await c.sellerLead.create({
        data: { name: `S ${s}`, email: `s_${s}@integ.test`, phone: '600000000' },
      })
      const vehicle = await c.vehicle.create({
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
      const buyer = await c.buyerLead.create({
        data: { name: `B ${s}`, email: `b_${s}@integ.test`, phone: '600000001' },
      })
      // offer_id = NULL: solo posible en el estado expand (columna nullable). Raw evita el cliente.
      await c.$executeRawUnsafe(
        `INSERT INTO "deliveries"
           ("id","vehicle_id","buyer_lead_id","offer_id","scheduled_at","status","created_at","updated_at")
         VALUES ($1,$2,$3, NULL, now(), 'PROGRAMADA'::"DeliveryStatus", now(), now())`,
        `d_${s}`,
        vehicle.id,
        buyer.id
      )
      const n = await c.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int AS n FROM "deliveries" WHERE "offer_id" IS NULL`
      )
      cap.nullCountBeforeContract = n[0]?.n ?? -1
    })

    // (5) Preflight FAIL: ahora hay un offer_id NULL.
    cap.preflightFailCode = runPreflight(true)

    // (6) Añade la 6ª migración versionada y ejecuta el deploy contract real → debe fallar.
    cpSync(join(REPO_MIGRATIONS, CONTRACT_MIGRATION), join(migDir, CONTRACT_MIGRATION), {
      recursive: true,
    })
    cap.deployContract = deploy()

    // (7) Estado tras el fallo: schema, datos e _prisma_migrations.
    await withClient(async (c) => {
      cap.offerIdNullableAfterFail = await offerIdNullable(c)
      cap.fkAfterFail = await fkPresent(c)
      cap.normalIdxAfterFail = await idxPresent(c, 'deliveries_offer_id_idx')
      cap.partialIdxAfterFail = await idxPresent(c, 'deliveries_active_vehicle_key')
      const rows = await c.$queryRawUnsafe<Array<any>>(
        `SELECT migration_name, finished_at, rolled_back_at, applied_steps_count,
                (logs IS NOT NULL) AS has_logs
         FROM "_prisma_migrations" WHERE migration_name=$1`,
        CONTRACT_MIGRATION
      )
      cap.migrationRow = rows[0]
        ? {
            migration_name: rows[0].migration_name,
            finished_at: rows[0].finished_at,
            rolled_back_at: rows[0].rolled_back_at,
            applied_steps_count: Number(rows[0].applied_steps_count),
            has_logs: rows[0].has_logs === true,
          }
        : null
      const nullRow = await c.$queryRawUnsafe<Array<{ offer_id: string | null }>>(
        `SELECT "offer_id" FROM "deliveries" WHERE "offer_id" IS NULL`
      )
      cap.nullRowIntact = nullRow.length === 1
      cap.nullRowValueNull = nullRow.length === 1 && nullRow[0].offer_id === null
    })

    // (8) Segundo deploy sin reparar: debe quedar bloqueado por la migración fallida (P3009).
    cap.secondDeploy = deploy()
  } catch (e) {
    cap.setupError = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)
  }
}, 300_000)

afterAll(async () => {
  // Descarta por completo la base efímera, aunque quede un intento de migración fallido activo.
  try {
    if (tempDb) psql('postgres', `DROP DATABASE IF EXISTS "${tempDb}" WITH (FORCE)`)
  } catch {
    /* best-effort */
  }
  if (workDir) rmSync(workDir, { recursive: true, force: true })
})

function ensureSetup() {
  if (cap.setupError) throw new Error(`setup falló: ${cap.setupError}`)
}

describe('setup real de Prisma Migrate (base efímera independiente)', () => {
  it('las 5 primeras migraciones se aplicaron; expand schema correcto; 6ª pendiente', () => {
    ensureSetup()
    expect(cap.deploy5Code).toBe(0)
    expect(cap.offerIdNullableAfter5).toBe('YES')
    expect(cap.fkAfter5).toBe(true)
    expect(cap.normalIdxAfter5).toBe(true)
    expect(cap.partialIdxAfter5).toBe(true)
    expect(cap.fifthApplied).toBe(true)
    expect(cap.sixthPresentAfter5).toBe(false)
  })

  it('preflight PASS con base sana (nullable, sin deliveries) → exit 0', () => {
    ensureSetup()
    expect(cap.preflightPassCode).toBe(0)
  })

  it('preflight FAIL cuando existe un offer_id NULL → exit 1', () => {
    ensureSetup()
    expect(cap.nullCountBeforeContract).toBe(1)
    expect(cap.preflightFailCode).toBe(1)
  })
})

describe('fallo real de la migración contract con offer_id NULL', () => {
  it('prisma migrate deploy termina con exit code distinto de cero', () => {
    ensureSetup()
    expect(cap.deployContract.code).not.toBe(0)
  })

  it('el fallo corresponde a la 6ª migración y a un error NOT NULL (23502)', () => {
    ensureSetup()
    const text = `${cap.deployContract.out}\n${cap.deployContract.err}`
    expect(text).toContain(CONTRACT_MIGRATION)
    expect(text.toLowerCase()).toMatch(/not.?null|23502/)
  })

  it('sin DDL parcial: offer_id sigue nullable y FK/índices intactos', () => {
    ensureSetup()
    expect(cap.offerIdNullableAfterFail).toBe('YES')
    expect(cap.fkAfterFail).toBe(true)
    expect(cap.normalIdxAfterFail).toBe(true)
    expect(cap.partialIdxAfterFail).toBe(true)
  })

  it('la fila con offer_id NULL permanece intacta (no modificada ni eliminada)', () => {
    ensureSetup()
    expect(cap.nullRowIntact).toBe(true)
    expect(cap.nullRowValueNull).toBe(true)
  })

  it('_prisma_migrations registra un intento fallido activo (finished_at NULL, no rolled-back)', () => {
    ensureSetup()
    const row = cap.migrationRow
    expect(row).not.toBeNull()
    expect(row!.migration_name).toBe(CONTRACT_MIGRATION)
    expect(row!.finished_at).toBeNull()
    expect(row!.rolled_back_at).toBeNull()
    expect(row!.applied_steps_count).toBe(0)
    expect(row!.has_logs).toBe(true)
  })

  it('un segundo migrate deploy queda bloqueado por la migración fallida (P3009)', () => {
    ensureSetup()
    expect(cap.secondDeploy.code).not.toBe(0)
    const text = `${cap.secondDeploy.out}\n${cap.secondDeploy.err}`
    expect(text).toMatch(/P3009|failed migration|migración.*fallid/i)
  })
})
