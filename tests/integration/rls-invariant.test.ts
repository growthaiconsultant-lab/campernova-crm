/**
 * Test de integración de la invariante RLS (PR0 · 8.3).
 *
 * Confirma, contra la base de datos REAL ya migrada, que NINGUNA tabla ordinaria del
 * esquema `public` tiene Row Level Security deshabilitada. Es la misma invariante que
 * ejecuta el script `pnpm check:rls`; aquí se afirma también como test de la suite.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createGuardedTestPrisma, countTablesWithoutRls } from './db'

let prisma: PrismaClient

beforeAll(() => {
  prisma = createGuardedTestPrisma()
})

afterAll(async () => {
  await prisma?.$disconnect()
})

describe('integración · invariante RLS', () => {
  it('8.3 · todas las tablas de public tienen RLS habilitada tras aplicar las migraciones', async () => {
    const offenders = await prisma.$queryRaw<Array<{ relname: string }>>`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
      ORDER BY c.relname
    `
    // Mensaje claro si falla: lista las tablas incumplidoras.
    expect(offenders.map((o) => o.relname)).toEqual([])
  })

  it('8.3 · el contador de tablas sin RLS es exactamente 0', async () => {
    expect(await countTablesWithoutRls(prisma)).toBe(0)
  })
})
