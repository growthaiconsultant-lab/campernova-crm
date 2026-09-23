/** Pure, offline identity check. Never return connection strings or parser errors. */
const STAGING_PROJECT = 'iatuhydsfwoeprpbklod'
const SAFE_QUERY_KEYS = new Set([
  'pgbouncer',
  'connection_limit',
  'pool_timeout',
  'connect_timeout',
  'socket_timeout',
  'statement_cache_size',
  'sslmode',
  'sslaccept',
  'schema',
])

function isStagingConnection(value: string | undefined): boolean {
  if (!value || value.trim() !== value) return false
  try {
    const url = new URL(value)
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return false
    if (url.pathname !== '/postgres' || url.hash || !url.password) return false
    if (url.port && !['5432', '6543'].includes(url.port)) return false
    // Fail closed on unknown parameters (including host/user/database overrides).
    for (const key of Array.from(url.searchParams.keys())) {
      if (!SAFE_QUERY_KEYS.has(key) || url.searchParams.getAll(key).length !== 1) return false
    }
    if (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public') return false
    const username = decodeURIComponent(url.username)
    if (url.hostname === `db.${STAGING_PROJECT}.supabase.co`) return username === 'postgres'
    return (
      /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) &&
      username === `postgres.${STAGING_PROJECT}`
    )
  } catch {
    return false
  }
}

export function previewDatabasePreflight(env: {
  [key: string]: string | undefined
  VERCEL_ENV?: string
  DATABASE_URL?: string
  DIRECT_URL?: string
}): 'SKIP' | 'PASS' | 'BLOCKED' {
  // Do not even read credentials outside Preview. No effect on the production guard.
  if (env.VERCEL_ENV !== 'preview') return 'SKIP'
  return isStagingConnection(env.DATABASE_URL) && isStagingConnection(env.DIRECT_URL)
    ? 'PASS'
    : 'BLOCKED'
}
