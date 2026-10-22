/** Explicit, one-migration operator. Ordinary builds never mutate the database. */
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { buyerStatusMigrationIdentity } from '../lib/deploy/buyer-status-migration'
import {
  computeLocalMigrations,
  evaluateMigrations,
  safeErrorCode,
  type RemoteMigrationRow,
} from '../lib/deploy/migration-guard'

const migration = '20261022170000_buyer_merge_identity'
async function main() {
  if (!process.env.BUYER_MERGE_MIGRATION_APPLY) return
  if (
    process.env.BUYER_MERGE_MIGRATION_APPLY !== migration ||
    process.env.VERCEL_ENV !== 'production'
  )
    throw Error('INVALID_OPERATOR_SCOPE')
  const identity = buyerStatusMigrationIdentity({
    ...process.env,
    BUYER_STATUS_MIGRATION_ENV: 'production',
  })
  const db = new PrismaClient({ datasourceUrl: identity.url, log: [] })
  try {
    const local = computeLocalMigrations(join(process.cwd(), 'prisma/migrations'))
    const history = () =>
      db.$queryRaw<
        RemoteMigrationRow[]
      >`SELECT migration_name, checksum, started_at, finished_at, rolled_back_at FROM _prisma_migrations`
    const check = evaluateMigrations(local, await history())
    if (check.ok) {
      console.log('BUYER_MERGE_MIGRATION_ALREADY_APPLIED')
      return
    }
    if (
      check.problems.length !== 1 ||
      check.problems[0].migration !== migration ||
      check.problems[0].kind !== 'MISSING_REMOTE'
    )
      throw Error('UNEXPECTED_MIGRATION_HISTORY')
    const result = spawnSync(
      process.execPath,
      [join(process.cwd(), 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      {
        encoding: 'utf8',
        timeout: 120000,
        env: { ...process.env, DATABASE_URL: identity.url, DIRECT_URL: identity.url },
      }
    )
    // Prisma output can include connection details: log only a fixed outcome.
    if (result.status !== 0) throw Error('MIGRATION_FAILED')
    if (!evaluateMigrations(local, await history()).ok) throw Error('MIGRATION_POSTFLIGHT_FAILED')
    console.log('BUYER_MERGE_MIGRATION_VERIFIED')
  } finally {
    await db.$disconnect()
  }
}
main().catch((error) => {
  const allowed = [
    'INVALID_OPERATOR_SCOPE',
    'UNEXPECTED_MIGRATION_HISTORY',
    'MIGRATION_FAILED',
    'MIGRATION_POSTFLIGHT_FAILED',
  ]
  console.error(
    'BUYER_MERGE_MIGRATION_STOPPED ' +
      (allowed.includes(error?.message) ? error.message : safeErrorCode(error))
  )
  process.exitCode = 1
})
