/** COM-9 privileged operator; read-only by default. No credentials or buyer PII in output. */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { activateBuyerAssignment } from '../lib/buyer-assignment'
import {
  computeLocalMigrations,
  evaluateMigrations,
  safeErrorCode,
  type RemoteMigrationRow,
} from '../lib/deploy/migration-guard'
import { buyerStatusMigrationIdentity } from '../lib/deploy/buyer-status-migration'

const migration = '20261021120000_add_buyer_assignment'
async function main() {
  const identity = buyerStatusMigrationIdentity({
    ...process.env,
    BUYER_STATUS_MIGRATION_ENV: process.env.BUYER_ASSIGNMENT_ENV,
  })
  const db = new PrismaClient({ datasourceUrl: identity.url, log: [] })
  try {
    const local = computeLocalMigrations(join(process.cwd(), 'prisma/migrations'))
    const history = await db.$queryRaw<
      RemoteMigrationRow[]
    >`SELECT migration_name, checksum, started_at, finished_at, rolled_back_at FROM _prisma_migrations`
    const evaluation = evaluateMigrations(local, history)
    const pending =
      !evaluation.ok &&
      evaluation.problems.length === 1 &&
      evaluation.problems[0].migration === migration &&
      evaluation.problems[0].kind === 'MISSING_REMOTE'
    if (!evaluation.ok && !pending) throw Error('UNEXPECTED_MIGRATION_HISTORY')
    const users = await db.user.findMany({
      select: { id: true, name: true, active: true, role: true },
    })
    const unassigned = await db.buyerLead.count({ where: { agentId: null } })
    console.log(
      'ASSIGNMENT_PREFLIGHT ' +
        JSON.stringify({
          environment: identity.environment,
          ref: identity.ref,
          pending,
          unassigned,
          users,
        })
    )
    const mode = process.env.BUYER_ASSIGNMENT_APPLY
    if (mode === migration && pending) {
      const result = spawnSync('pnpm', ['prisma', 'migrate', 'deploy'], {
        encoding: 'utf8',
        timeout: 120_000,
        env: { ...process.env, DATABASE_URL: identity.url, DIRECT_URL: identity.url },
      })
      if (result.status !== 0) throw Error('MIGRATION_FAILED')
      const after = await db.$queryRaw<
        RemoteMigrationRow[]
      >`SELECT migration_name, checksum, started_at, finished_at, rolled_back_at FROM _prisma_migrations`
      if (!evaluateMigrations(local, after).ok) throw Error('MIGRATION_POSTFLIGHT_FAILED')
      console.log('ASSIGNMENT_MIGRATION_VERIFIED')
    } else if (mode === 'activate') {
      if (pending) throw Error('MIGRATION_REQUIRED')
      const pool: { id: string; name: string }[] = JSON.parse(
        process.env.BUYER_ASSIGNMENT_POOL || '[]'
      )
      if (
        pool.length !== 4 ||
        pool.some(
          (entry) =>
            !users.some(
              (user) =>
                user.id === entry.id &&
                user.name === entry.name &&
                user.active &&
                ['ADMIN', 'AGENTE'].includes(user.role)
            )
        )
      )
        throw Error('POOL_IDENTITY_MISMATCH')
      const expected = Number(process.env.BUYER_ASSIGNMENT_EXPECT_UNASSIGNED)
      if (
        !Number.isSafeInteger(expected) ||
        expected < 0 ||
        process.env.BUYER_ASSIGNMENT_EXPECT_UNASSIGNED === undefined
      )
        throw Error('EXPECTED_COUNT_REQUIRED')
      const result = await activateBuyerAssignment(
        db,
        pool.map((entry) => entry.id),
        expected
      )
      console.log(
        'ASSIGNMENT_APPLIED ' +
          JSON.stringify({
            ...result,
            distribution: pool.map((entry) => ({
              name: entry.name,
              assigned: result.counts[entry.id],
            })),
          })
      )
    } else if (mode && mode !== migration) throw Error('INVALID_MODE')
    if (!pending || mode === migration) {
      const config =
        await db.$queryRaw`SELECT enabled, agent_ids, next_index FROM buyer_lead_assignment`
      const triggers =
        await db.$queryRaw`SELECT tgenabled FROM pg_trigger WHERE tgrelid = 'public.buyer_leads'::regclass AND tgname = 'buyer_lead_auto_assignment'`
      const counts = await db.buyerLead.groupBy({ by: ['agentId'], _count: true })
      console.log('ASSIGNMENT_POSTFLIGHT ' + JSON.stringify({ config, triggers, counts }))
    }
  } finally {
    await db.$disconnect()
  }
}
main().catch((error) => {
  const safe = [
    'UNEXPECTED_MIGRATION_HISTORY',
    'MIGRATION_FAILED',
    'MIGRATION_POSTFLIGHT_FAILED',
    'MIGRATION_REQUIRED',
    'POOL_IDENTITY_MISMATCH',
    'EXPECTED_COUNT_REQUIRED',
    'INVALID_MODE',
    'INVALID_POOL',
    'INVALID_ACTIVE_USERS',
    'POOL_MISMATCH',
    'PREFLIGHT_COUNT_CHANGED',
    'ASSIGNMENT_CONFLICT',
    'EXISTING_ASSIGNMENT_CHANGED',
    'UNASSIGNED_REMAIN',
  ]
  console.error(
    'ASSIGNMENT_STOPPED ' +
      (error instanceof Error && safe.includes(error.message)
        ? error.message
        : safeErrorCode(error))
  )
  process.exitCode = 1
})
