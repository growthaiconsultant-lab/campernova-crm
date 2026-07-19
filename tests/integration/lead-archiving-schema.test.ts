/**
 * Integración (PostgreSQL real) — invariantes ESTRUCTURALES del modelo de archivado (PR B1).
 *
 * PR B1 es exclusivamente schema + migración: no hay backend ni UI de archivado todavía. Estos
 * tests comprueban, sobre la base efímera ya migrada, lo que los conteos de catálogo del job
 * `migration-replay` NO cubren por sí solos: nulabilidad, ausencia de defaults, regla de borrado
 * de las FKs, existencia de índices y valores de enum. Y, sobre todo, que la migración **no
 * archivó ningún registro existente** (cero backfill).
 *
 * Solo lectura del catálogo: no escribe datos ni ejecuta DDL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createGuardedTestPrisma } from './db'

let prisma: PrismaClient

const LEAD_TABLES = ['seller_leads', 'buyer_leads'] as const
const ARCHIVE_COLUMNS = [
  'archived_at',
  'archived_by_id',
  'archive_reason',
  'archive_notes',
] as const

beforeAll(() => {
  prisma = createGuardedTestPrisma({ requireReset: false })
})
afterAll(async () => {
  await prisma.$disconnect()
})

describe('enum ArchiveReason', () => {
  it('existe con exactamente los 6 valores autorizados', async () => {
    const rows = await prisma.$queryRaw<Array<{ label: string }>>`
      SELECT e.enumlabel AS label
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ArchiveReason'
      ORDER BY e.enumsortorder
    `
    expect(rows.map((r) => r.label)).toEqual([
      'SIN_RESPUESTA',
      'FUERA_DE_MERCADO',
      'POSIBLE_DUPLICADO',
      'PRUEBA_INTERNA',
      'LIMPIEZA_BANDEJA',
      'OTRO',
    ])
  })
})

describe('enum ActivityType', () => {
  it('incorpora LEAD_ARCHIVADO y LEAD_REACTIVADO (aditivo)', async () => {
    const rows = await prisma.$queryRaw<Array<{ label: string }>>`
      SELECT e.enumlabel AS label
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ActivityType'
    `
    const labels = rows.map((r) => r.label)
    expect(labels).toContain('LEAD_ARCHIVADO')
    expect(labels).toContain('LEAD_REACTIVADO')
    // No se han perdido valores previos (muestra representativa).
    expect(labels).toContain('CAMBIO_ESTADO')
    expect(labels).toContain('TRUST_SELLO_REVOCADO')
  })
})

describe.each(LEAD_TABLES)('tabla %s — columnas de archivado', (table) => {
  it('tiene las 4 columnas, todas NULLABLE y SIN default', async () => {
    const rows = await prisma.$queryRaw<
      Array<{ column_name: string; is_nullable: string; column_default: string | null }>
    >`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
        AND column_name IN ('archived_at', 'archived_by_id', 'archive_reason', 'archive_notes')
      ORDER BY column_name
    `
    expect(rows.map((r) => r.column_name).sort()).toEqual([...ARCHIVE_COLUMNS].sort())
    for (const r of rows) {
      expect(r.is_nullable).toBe('YES')
      expect(r.column_default).toBeNull()
    }
  })

  it('la FK archived_by_id → users usa ON DELETE SET NULL', async () => {
    const rows = await prisma.$queryRaw<Array<{ delete_rule: string; foreign_table: string }>>`
      SELECT rc.delete_rule, ccu.table_name AS foreign_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = ${table}
        AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'archived_by_id'
    `
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].foreign_table).toBe('users')
    expect(rows[0].delete_rule).toBe('SET NULL')
  })

  it('existe un índice sobre archived_at', async () => {
    const rows = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${table} AND indexdef LIKE '%archived_at%'
    `
    expect(rows.length).toBeGreaterThan(0)
  })
})

describe('la migración no archiva nada (cero backfill)', () => {
  it('ningún seller_lead ni buyer_lead queda archivado tras migrar', async () => {
    const rows = await prisma.$queryRaw<
      Array<{ archived_sellers: number; archived_buyers: number }>
    >`
      SELECT
        (SELECT count(*)::int FROM seller_leads WHERE archived_at IS NOT NULL) AS archived_sellers,
        (SELECT count(*)::int FROM buyer_leads  WHERE archived_at IS NOT NULL) AS archived_buyers
    `
    expect(rows[0].archived_sellers).toBe(0)
    expect(rows[0].archived_buyers).toBe(0)
  })
})
