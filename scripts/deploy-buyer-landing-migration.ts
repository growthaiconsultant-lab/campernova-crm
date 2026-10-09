/** LANDING-2 one-off operator command. Never called by the normal application build.
 * Default is read-only. Apply requires a separately authorized deployment configuration.
 * Credentials stay in the existing Vercel environment; no secret values are logged/exported.
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import {
  computeLocalMigrations,
  evaluateMigrations,
  safeErrorCode,
  type RemoteMigrationRow,
} from '../lib/deploy/migration-guard'

const MIGRATION = '20261009090000_expand_buyer_landing_contact'
const PROD = 'bbmglaatlyilxutzomxd'
async function main() {
  const declared = process.env.LANDING_MIGRATION_ENV
  if (!['staging', 'production'].includes(declared || '')) throw Error('mode')
  if ((declared === 'production') !== (process.env.VERCEL_ENV === 'production'))
    throw Error('environment')
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname.split('.')[0]
  if (!/^[a-z]{20}$/.test(ref) || (declared === 'production' ? ref !== PROD : ref === PROD))
    throw Error('identity')
  const url = process.env.DIRECT_URL || ''
  if (!url.includes(ref)) throw Error('database identity')
  const db = new PrismaClient({ datasourceUrl: url, log: [] })
  const local = computeLocalMigrations(join(process.cwd(), 'prisma/migrations'))
  const history = () =>
    db.$queryRaw<
      RemoteMigrationRow[]
    >`SELECT migration_name, checksum, started_at, finished_at, rolled_back_at FROM "_prisma_migrations"`
  const columns = () => db.$queryRaw<
    { column_name: string; is_nullable: string; data_type: string }[]
  >`
    SELECT column_name, is_nullable, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='buyer_leads'
    AND column_name IN ('email','gdpr_consent_at','gdpr_consent_ip') ORDER BY column_name`
  try {
    const before = evaluateMigrations(local, await history())
    if (
      !before.ok &&
      (before.problems.length !== 1 ||
        before.problems[0].migration !== MIGRATION ||
        before.problems[0].kind !== 'MISSING_REMOTE')
    )
      throw Error('unexpected migration history')
    const schema = await columns()
    const count = await db.$queryRaw<
      { total: number; missing_email: number }[]
    >`SELECT count(*)::int AS total, count(*) FILTER (WHERE email IS NULL)::int AS missing_email FROM buyer_leads`
    // Schema snapshot and aggregate counts provide recovery evidence; never dump contacts.
    console.log(
      'landing-migration: preflight ' +
        JSON.stringify({
          environment: declared,
          ref,
          schema,
          counts: count,
          pending: before.problems.map((p) => p.migration),
        })
    )
    if (before.ok) {
      if (schema.length !== 3 || schema.some((c) => c.is_nullable !== 'YES'))
        throw Error('postflight schema')
      console.log('landing-migration: already applied and verified')
      return
    }
    if (schema.length !== 1 || schema[0].column_name !== 'email' || schema[0].is_nullable !== 'NO')
      throw Error('preflight schema')
    if (process.env.LANDING_MIGRATION_APPLY !== MIGRATION) {
      console.log('landing-migration: read-only; no migration applied')
      return
    }
    const result = spawnSync('pnpm', ['prisma', 'migrate', 'deploy'], {
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    })
    if (result.status !== 0) throw Error('migration apply failed; no automatic retry')
    if (!evaluateMigrations(local, await history()).ok) throw Error('postflight history')
    const after = await columns()
    if (after.length !== 3 || after.some((c) => c.is_nullable !== 'YES'))
      throw Error('postflight schema')
    console.log(
      'landing-migration: applied and verified ' +
        JSON.stringify({ environment: declared, ref, migration: MIGRATION, schema: after })
    )
  } finally {
    await db.$disconnect()
  }
}
main().catch((error: unknown) => {
  console.error('landing-migration: stopped; code=' + safeErrorCode(error))
  process.exit(1)
})
