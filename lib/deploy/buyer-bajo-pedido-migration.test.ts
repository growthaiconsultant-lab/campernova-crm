import { describe, expect, it } from 'vitest'
import {
  buyerStatusMigrationIdentity,
  buyerStatusMigrationSnapshot,
  BUYER_STATUS_MIGRATION,
} from './buyer-bajo-pedido-migration'
import type { RemoteMigrationRow } from './migration-guard'

const ref = 'bbmglaatlyilxutzomxd'
const env = {
  BUYER_STATUS_MIGRATION_ENV: 'production',
  VERCEL_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  DIRECT_URL: `postgresql://postgres.${ref}:qa@localhost/db`,
}
const local = [
  { name: 'baseline', checksum: 'baseline-checksum' },
  { name: BUYER_STATUS_MIGRATION, checksum: 'new-checksum' },
]
const row = (name: string, checksum: string): RemoteMigrationRow => ({
  migration_name: name,
  checksum,
  started_at: new Date(),
  finished_at: new Date(),
  rolled_back_at: null,
})
const baseline = row('baseline', 'baseline-checksum')
const values = [
  'NUEVO',
  'CONTACTADO',
  'CUALIFICADO',
  'EN_NEGOCIACION',
  'CERRADO',
  'PERDIDO',
  'NO_CONTESTA',
]

describe('COM-8 operador de migración, guards sin conexión', () => {
  it('acepta sólo identidad y entorno de producción coherentes', () => {
    expect(buyerStatusMigrationIdentity(env)).toMatchObject({ environment: 'production', ref })
  })
  it.each([
    { BUYER_STATUS_MIGRATION_ENV: undefined },
    { VERCEL_ENV: 'preview' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://iatuhydsfwoeprpbklod.supabase.co' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://example.test' },
    { DIRECT_URL: 'postgresql://qa:qa@localhost/db' },
  ])('falla cerrado para %j', (override) => {
    expect(() => buyerStatusMigrationIdentity({ ...env, ...override })).toThrow()
  })
  it('staging rechaza la identidad de producción', () => {
    expect(() =>
      buyerStatusMigrationIdentity({
        ...env,
        BUYER_STATUS_MIGRATION_ENV: 'staging',
        VERCEL_ENV: 'preview',
      })
    ).toThrow('PROJECT_IDENTITY_MISMATCH')
  })
  it('acepta sólo la nueva migración pendiente y enum previo intacto', () => {
    expect(buyerStatusMigrationSnapshot(local, [baseline], values)).toBe('pending')
  })
  it('reconoce un reintento ya aplicado sin necesitar otra escritura', () => {
    expect(
      buyerStatusMigrationSnapshot(
        local,
        [baseline, row(BUYER_STATUS_MIGRATION, 'new-checksum')],
        [...values, 'BAJO_PEDIDO']
      )
    ).toBe('already-applied')
  })
  it('bloquea otra migración pendiente', () => {
    expect(() =>
      buyerStatusMigrationSnapshot(
        [...local, { name: 'other', checksum: 'other' }],
        [baseline],
        values
      )
    ).toThrow('UNEXPECTED_MIGRATION_HISTORY')
  })
  it('bloquea checksum incorrecto e intento fallido', () => {
    expect(() => buyerStatusMigrationSnapshot(local, [row('baseline', 'wrong')], values)).toThrow()
    expect(() =>
      buyerStatusMigrationSnapshot(
        local,
        [baseline, { ...row('failed', 'x'), finished_at: null }],
        values
      )
    ).toThrow()
  })
  it('bloquea discrepancia entre enum e historial y ausencia del cambio local', () => {
    expect(() =>
      buyerStatusMigrationSnapshot(local, [baseline], [...values, 'BAJO_PEDIDO'])
    ).toThrow('UNEXPECTED_BUYER_ENUM')
    expect(() => buyerStatusMigrationSnapshot(local.slice(0, 1), [baseline], values)).toThrow(
      'MISSING_LOCAL_MIGRATION'
    )
  })
})
