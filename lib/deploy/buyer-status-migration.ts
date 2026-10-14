import { evaluateMigrations, type LocalMigration, type RemoteMigrationRow } from './migration-guard'

export const BUYER_STATUS_MIGRATION = '20261014160000_add_buyer_no_contesta_status'
const PRODUCTION_REF = 'bbmglaatlyilxutzomxd'
const PREVIOUS_VALUES = [
  'NUEVO',
  'CONTACTADO',
  'CUALIFICADO',
  'EN_NEGOCIACION',
  'CERRADO',
  'PERDIDO',
]

export function buyerStatusMigrationIdentity(env: Record<string, string | undefined>) {
  const environment = env.BUYER_STATUS_MIGRATION_ENV
  if (environment !== 'production' && environment !== 'staging') throw Error('INVALID_ENVIRONMENT')
  if ((environment === 'production') !== (env.VERCEL_ENV === 'production'))
    throw Error('ENVIRONMENT_MISMATCH')
  let ref: string
  try {
    const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL || '').hostname
    if (!host.endsWith('.supabase.co')) throw Error('host')
    ref = host.split('.')[0]
  } catch {
    throw Error('INVALID_PROJECT_IDENTITY')
  }
  if (
    !/^[a-z]{20}$/.test(ref) ||
    (environment === 'production' ? ref !== PRODUCTION_REF : ref === PRODUCTION_REF)
  )
    throw Error('PROJECT_IDENTITY_MISMATCH')
  const url = env.DIRECT_URL || ''
  if (!url.includes(ref)) throw Error('DATABASE_IDENTITY_MISMATCH')
  return { environment, ref, url }
}

export function buyerStatusMigrationSnapshot(
  local: LocalMigration[],
  remote: RemoteMigrationRow[],
  values: string[]
): 'already-applied' | 'pending' {
  if (!local.some((migration) => migration.name === BUYER_STATUS_MIGRATION))
    throw Error('MISSING_LOCAL_MIGRATION')
  const history = evaluateMigrations(local, remote)
  const pending =
    !history.ok &&
    history.problems.length === 1 &&
    history.problems[0].migration === BUYER_STATUS_MIGRATION &&
    history.problems[0].kind === 'MISSING_REMOTE'
  if (!history.ok && !pending) throw Error('UNEXPECTED_MIGRATION_HISTORY')
  const expected = pending ? PREVIOUS_VALUES : [...PREVIOUS_VALUES, 'NO_CONTESTA']
  if (JSON.stringify([...values].sort()) !== JSON.stringify([...expected].sort()))
    throw Error('UNEXPECTED_BUYER_ENUM')
  return pending ? 'pending' : 'already-applied'
}
