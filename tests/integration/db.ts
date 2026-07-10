/**
 * Helpers de base de datos para tests de integración (PR0).
 *
 * Todo acceso pasa primero por el guard (`guard.ts`): imposible conectar contra
 * staging/producción. Los tests usan Prisma REAL contra la base de datos de test
 * efímera definida en `TEST_DATABASE_URL`.
 *
 * Cimientos mínimos para que PR2/PR3/PR4 añadan tests de concurrencia, transacciones,
 * rollback e idempotencia. No se incluyen factories de negocio todavía.
 */
import { randomUUID } from 'node:crypto'
import { PrismaClient, type Prisma } from '@prisma/client'
import { requireTestDatabaseUrl } from './guard'

/**
 * Crea un cliente Prisma apuntando a la base de datos de test, tras validar el guard.
 * Lanza si el entorno no es una base de datos de test segura.
 *
 * `requireReset` por defecto true: los tests de integración escriben/limpian datos, así
 * que exigen la señal explícita `ALLOW_INTEGRATION_DB_RESET=true`.
 */
export function createGuardedTestPrisma(options: { requireReset?: boolean } = {}): PrismaClient {
  const url = requireTestDatabaseUrl(process.env, {
    requireReset: options.requireReset ?? true,
  })
  return new PrismaClient({ datasourceUrl: url })
}

/** Sufijo único para aislar datos de test entre ejecuciones (sin colisiones ni residuos). */
export function uniqueSuffix(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12)
}

/**
 * Ejecuta `fn` dentro de una transacción que SIEMPRE se revierte (rollback). Útil para
 * que PR2/PR3/PR4 prueben efectos sin dejar residuos. Se implementa lanzando un error
 * centinela tras `fn` para forzar el rollback de la transacción interactiva de Prisma.
 */
export async function withRollbackTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const ROLLBACK = Symbol('rollback')
  let result: T
  try {
    await prisma.$transaction(async (tx) => {
      result = await fn(tx)
      throw ROLLBACK
    })
  } catch (err) {
    if (err !== ROLLBACK) throw err
  }
  return result!
}

/** Nº de tablas ordinarias de `public` sin RLS (0 = invariante cumplida). */
export async function countTablesWithoutRls(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
  `
  return rows[0]?.n ?? 0
}

/** Nº de migraciones aplicadas y finalizadas en `_prisma_migrations`. */
export async function countAppliedMigrations(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM public._prisma_migrations WHERE finished_at IS NOT NULL
  `
  return rows[0]?.n ?? 0
}

/** Comprueba si una tabla existe en `public`. */
export async function tableExists(prisma: PrismaClient, table: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${table}
    ) AS exists
  `
  return rows[0]?.exists ?? false
}
