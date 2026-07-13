import { describe, it, expect } from 'vitest'
import {
  resolveMigrationTarget,
  MigrationGuardError,
  STAGING_DB_REF,
  PRODUCTION_DB_REF,
  PRODUCTION_ACK,
} from './migration-env-guard'

const LOCAL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const STAGING = `postgresql://postgres.${STAGING_DB_REF}:pw@aws-1-eu-central-1.pooler.supabase.com:6543/postgres`
const PROD = `postgresql://postgres.${PRODUCTION_DB_REF}:pw@aws-1-eu-central-1.pooler.supabase.com:6543/postgres`

describe('resolveMigrationTarget · local', () => {
  it('acepta una URL local', () => {
    const r = resolveMigrationTarget({
      env: 'local',
      operation: 'audit',
      processEnv: { DATABASE_URL: LOCAL },
    })
    expect(r.env).toBe('local')
  })
  it('rechaza --env local con URL de staging/producción o host gestionado', () => {
    expect(() =>
      resolveMigrationTarget({
        env: 'local',
        operation: 'audit',
        processEnv: { DATABASE_URL: STAGING },
      })
    ).toThrow(MigrationGuardError)
    expect(() =>
      resolveMigrationTarget({
        env: 'local',
        operation: 'backfill',
        processEnv: { DATABASE_URL: PROD },
      })
    ).toThrow(MigrationGuardError)
  })
  it('rechaza si falta DATABASE_URL', () => {
    expect(() =>
      resolveMigrationTarget({ env: 'local', operation: 'audit', processEnv: {} })
    ).toThrow(MigrationGuardError)
  })
})

describe('resolveMigrationTarget · staging', () => {
  it('requiere ALLOW_STAGING_DOCUMENT_AUDIT=true y URL de staging', () => {
    expect(() =>
      resolveMigrationTarget({
        env: 'staging',
        operation: 'audit',
        processEnv: { DATABASE_URL: STAGING },
      })
    ).toThrow(/ALLOW_STAGING_DOCUMENT_AUDIT/)

    const ok = resolveMigrationTarget({
      env: 'staging',
      operation: 'audit',
      processEnv: { DATABASE_URL: STAGING, ALLOW_STAGING_DOCUMENT_AUDIT: 'true' },
    })
    expect(ok.env).toBe('staging')
  })
  it('la variable de backfill es distinta de la de audit', () => {
    // Con la de audit NO se autoriza un backfill.
    expect(() =>
      resolveMigrationTarget({
        env: 'staging',
        operation: 'backfill',
        processEnv: { DATABASE_URL: STAGING, ALLOW_STAGING_DOCUMENT_AUDIT: 'true' },
      })
    ).toThrow(/ALLOW_STAGING_DOCUMENT_BACKFILL/)
  })
  it('rechaza declarar staging con una URL de producción', () => {
    expect(() =>
      resolveMigrationTarget({
        env: 'staging',
        operation: 'audit',
        processEnv: { DATABASE_URL: PROD, ALLOW_STAGING_DOCUMENT_AUDIT: 'true' },
      })
    ).toThrow(/PRODUCCIÓN/)
  })
})

describe('resolveMigrationTarget · production', () => {
  it('requiere allow-var, URL de producción y segunda confirmación exacta', () => {
    const envBase = { DATABASE_URL: PROD, ALLOW_PRODUCTION_DOCUMENT_BACKFILL: 'true' }
    // Sin ack → rechazo.
    expect(() =>
      resolveMigrationTarget({ env: 'production', operation: 'backfill', processEnv: envBase })
    ).toThrow(/segunda confirmación/)
    // Con ack correcto → ok.
    const ok = resolveMigrationTarget({
      env: 'production',
      operation: 'backfill',
      processEnv: envBase,
      confirm: PRODUCTION_ACK,
    })
    expect(ok.env).toBe('production')
  })
  it('rechaza sin la allow-var de producción aunque haya ack', () => {
    expect(() =>
      resolveMigrationTarget({
        env: 'production',
        operation: 'backfill',
        processEnv: { DATABASE_URL: PROD },
        confirm: PRODUCTION_ACK,
      })
    ).toThrow(/ALLOW_PRODUCTION_DOCUMENT_BACKFILL/)
  })
})
