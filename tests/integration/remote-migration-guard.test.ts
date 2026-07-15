/**
 * Integración (PostgreSQL real) del guard de migraciones remotas.
 *
 * Ejecuta la MISMA consulta de solo lectura sobre `_prisma_migrations` que usa
 * `scripts/check-remote-migrations.ts` contra la base de test efímera ya migrada
 * (baseline + `20260712000000_add_versioned_document_model`), y comprueba que:
 *  - con el estado real coherente, el guard devuelve PASS;
 *  - si la migración documental faltara en la BD (forma real del incidente del 15-jul),
 *    el guard la detectaría como MISSING_REMOTE;
 *  - el checksum almacenado por Prisma coincide con el SHA-256 del fichero local.
 *
 * Es solo lectura: no escribe en `_prisma_migrations` ni ejecuta DDL/DML.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { createGuardedTestPrisma } from './db'
import {
  computeLocalMigrations,
  evaluateMigrations,
  type RemoteMigrationRow,
} from '@/lib/deploy/migration-guard'

let prisma: PrismaClient

async function readRemote(): Promise<RemoteMigrationRow[]> {
  return prisma.$queryRaw<RemoteMigrationRow[]>`
    SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
    FROM "_prisma_migrations"
  `
}

beforeAll(() => {
  // Solo lectura → no exige la señal de reset.
  prisma = createGuardedTestPrisma({ requireReset: false })
})
afterAll(async () => {
  await prisma.$disconnect()
})

describe('guard de migraciones remotas — PostgreSQL real', () => {
  it('con el estado real coherente (todas aplicadas) → PASS', async () => {
    const local = computeLocalMigrations(join(process.cwd(), 'prisma', 'migrations'))
    const remote = await readRemote()
    const result = evaluateMigrations(local, remote)
    expect(result.problems).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.localCount).toBeGreaterThanOrEqual(2)
  })

  it('el checksum remoto de la migración documental == SHA-256 del fichero local', async () => {
    const local = computeLocalMigrations(join(process.cwd(), 'prisma', 'migrations'))
    const remote = await readRemote()
    const name = '20260712000000_add_versioned_document_model'
    const localMig = local.find((m) => m.name === name)!
    const remoteRow = remote.find((r) => r.migration_name === name && r.finished_at != null)!
    expect(remoteRow.checksum).toBe(localMig.checksum)
  })

  it('si la migración documental faltara en la BD (incidente 15-jul) → FAIL MISSING_REMOTE', async () => {
    const local = computeLocalMigrations(join(process.cwd(), 'prisma', 'migrations'))
    const remote = (await readRemote()).filter(
      (r) => r.migration_name !== '20260712000000_add_versioned_document_model'
    )
    const result = evaluateMigrations(local, remote)
    expect(result.ok).toBe(false)
    expect(result.problems).toContainEqual({
      migration: '20260712000000_add_versioned_document_model',
      kind: 'MISSING_REMOTE',
    })
  })
})
