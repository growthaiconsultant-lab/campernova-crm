import { describe, expect, it } from 'vitest'
import { previewDatabasePreflight } from './preview-database-preflight'

// Synthetic credentials only. Project identifiers are public, not authentication material.
const staging = 'iatuhydsfwoeprpbklod'
const production = 'bbmglaatlyilxutzomxd'
const direct = `postgresql://postgres:fixture-only@db.${staging}.supabase.co:5432/postgres`
const pooled = `postgresql://postgres.${staging}:fixture-only@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`

describe('Preview database identity preflight', () => {
  it.each([undefined, 'development', 'production', 'custom'])(
    'does not read credentials outside Preview (%s)',
    (VERCEL_ENV) => {
      expect(
        previewDatabasePreflight({
          VERCEL_ENV,
          get DATABASE_URL(): string {
            throw new Error('must not read')
          },
          get DIRECT_URL(): string {
            throw new Error('must not read')
          },
        })
      ).toBe('SKIP')
    }
  )

  it.each([
    [pooled, direct],
    [direct, direct],
    [pooled, pooled.replace(':6543', ':5432')],
    [direct.replace('postgresql:', 'postgres:'), direct + '?sslmode=require&schema=public'],
  ])('accepts only both verified staging connections', (DATABASE_URL, DIRECT_URL) => {
    expect(previewDatabasePreflight({ VERCEL_ENV: 'preview', DATABASE_URL, DIRECT_URL })).toBe(
      'PASS'
    )
  })

  const rejected = [
    undefined,
    '',
    'not a URL',
    direct.replace(staging, production),
    pooled.replace(staging, production),
    direct.replace(`db.${staging}.supabase.co`, 'localhost'),
    direct.replace(`db.${staging}.supabase.co`, `db.${staging}.supabase.co.example.invalid`),
    pooled.replace('pooler.supabase.com', 'pooler.supabase.com.example.invalid'),
    direct.replace('postgresql:', 'https:'),
    direct.replace('/postgres', '/other'),
    direct.replace(':5432', ':9999'),
    direct.replace('fixture-only', ''),
    direct.replace('postgres:', `postgres.${production}:`),
    direct.replace(staging, production) + `?application_name=${staging}`,
    direct + '#ignored',
    direct + '?host=production.invalid',
    direct + '?schema=private',
    direct + '?sslmode=require&sslmode=disable',
    direct + ' ',
    direct.replace('postgres:', 'postgres%ZZ:'),
  ]
  it.each(rejected.map((value, index) => ({ value, index })))(
    'blocks missing, mixed, spoofed or unsupported connection $index on either input',
    ({ value }) => {
      expect(
        previewDatabasePreflight({ VERCEL_ENV: 'preview', DATABASE_URL: value, DIRECT_URL: direct })
      ).toBe('BLOCKED')
      expect(
        previewDatabasePreflight({ VERCEL_ENV: 'preview', DATABASE_URL: pooled, DIRECT_URL: value })
      ).toBe('BLOCKED')
    }
  )
})
