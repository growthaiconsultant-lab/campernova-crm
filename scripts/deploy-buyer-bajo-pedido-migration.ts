/** COM-8: operador explícito; nunca ejecutado por el build normal ni por la aplicación.
 * Predeterminado sólo lectura. El modo apply necesita el nombre exacto de la migración.
 * Las credenciales permanecen en el entorno Vercel; no se imprimen ni exportan.
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import {
  computeLocalMigrations,
  safeErrorCode,
  type RemoteMigrationRow,
} from '../lib/deploy/migration-guard'
import {
  BUYER_STATUS_MIGRATION,
  buyerStatusMigrationIdentity,
  buyerStatusMigrationSnapshot,
} from '../lib/deploy/buyer-bajo-pedido-migration'

async function main() {
  const identity = buyerStatusMigrationIdentity(process.env)
  const db = new PrismaClient({ datasourceUrl: identity.url, log: [] })
  const local = computeLocalMigrations(join(process.cwd(), 'prisma/migrations'))
  async function snapshot() {
    const [history, enums] = await Promise.all([
      db.$queryRaw<
        RemoteMigrationRow[]
      >`SELECT migration_name, checksum, started_at, finished_at, rolled_back_at FROM "_prisma_migrations"`,
      db.$queryRaw<{ enumlabel: string }[]>`
        SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'BuyerLeadStatus' ORDER BY e.enumsortorder`,
    ])
    return { history, values: enums.map((value) => value.enumlabel) }
  }
  try {
    const before = await snapshot()
    const state = buyerStatusMigrationSnapshot(local, before.history, before.values)
    console.log(
      'buyer-status-migration: preflight ' +
        JSON.stringify({
          environment: identity.environment,
          ref: identity.ref,
          state,
          enumValues: before.values,
          migration: BUYER_STATUS_MIGRATION,
        })
    )
    if (state === 'already-applied') {
      console.log('buyer-status-migration: already applied and verified')
      return
    }
    if (process.env.BUYER_STATUS_MIGRATION_APPLY !== BUYER_STATUS_MIGRATION) {
      console.log('buyer-status-migration: read-only; no migration applied')
      return
    }
    const result = spawnSync('pnpm', ['prisma', 'migrate', 'deploy'], {
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, DATABASE_URL: identity.url, DIRECT_URL: identity.url },
    })
    if (result.status !== 0) throw Error('MIGRATION_APPLY_FAILED_NO_AUTOMATIC_RETRY')
    const after = await snapshot()
    if (buyerStatusMigrationSnapshot(local, after.history, after.values) !== 'already-applied')
      throw Error('POSTFLIGHT_FAILED')
    console.log(
      'buyer-status-migration: applied and verified ' +
        JSON.stringify({
          environment: identity.environment,
          ref: identity.ref,
          migration: BUYER_STATUS_MIGRATION,
          enumValues: after.values,
        })
    )
  } finally {
    await db.$disconnect()
  }
}
main().catch((error) => {
  // Nunca volcar errores Prisma que puedan incluir hosts, URLs o credenciales.
  const operatorCodes = [
    'INVALID_ENVIRONMENT',
    'ENVIRONMENT_MISMATCH',
    'INVALID_PROJECT_IDENTITY',
    'PROJECT_IDENTITY_MISMATCH',
    'DATABASE_IDENTITY_MISMATCH',
    'MISSING_LOCAL_MIGRATION',
    'UNEXPECTED_MIGRATION_HISTORY',
    'UNEXPECTED_BUYER_ENUM',
    'MIGRATION_APPLY_FAILED_NO_AUTOMATIC_RETRY',
    'POSTFLIGHT_FAILED',
  ]
  const code =
    error instanceof Error && operatorCodes.includes(error.message)
      ? error.message
      : safeErrorCode(error)
  console.error('buyer-status-migration: stopped; code=' + code)
  process.exit(1)
})
