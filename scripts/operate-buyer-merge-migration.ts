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

const buyerMigration = '20261022170000_buyer_merge_identity'
const mainMigrations = ['20261119120000_capture_stages', '20261120120000_buyer_followup_title']
async function main() {
  const trailers = process.env.VERCEL_GIT_COMMIT_MESSAGE?.split(/\r?\n/)
  const authorizedMigration =
    process.env.VERCEL_ENV === 'production' && process.env.VERCEL_GIT_COMMIT_REF === 'main'
      ? mainMigrations.find((name) => trailers?.includes('Apply-Migration: ' + name))
      : undefined
  const migration = authorizedMigration ?? process.env.BUYER_MERGE_MIGRATION_APPLY
  if (!migration) return
  if (
    (!authorizedMigration && migration !== buyerMigration) ||
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
      console.log('Migration already applied', migration)
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
    console.log('Migration verified', migration)
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
