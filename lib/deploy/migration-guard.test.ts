import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import {
  evaluateMigrations,
  computeLocalMigrations,
  resolveGuardMode,
  urlMatchesExpectation,
  PROBLEM_LABELS,
  type LocalMigration,
  type RemoteMigrationRow,
} from './migration-guard'

const D = (iso: string) => new Date(iso)

/** Helper: fila aplicada correctamente. */
function applied(name: string, checksum: string): RemoteMigrationRow {
  return {
    migration_name: name,
    checksum,
    started_at: D('2026-07-10T10:00:00Z'),
    finished_at: D('2026-07-10T10:00:01Z'),
    rolled_back_at: null,
  }
}
function rolledBack(name: string, checksum: string | null = null): RemoteMigrationRow {
  return {
    migration_name: name,
    checksum,
    started_at: D('2026-07-10T10:00:00Z'),
    finished_at: null,
    rolled_back_at: D('2026-07-10T10:00:02Z'),
  }
}
function failedAttempt(name: string): RemoteMigrationRow {
  return {
    migration_name: name,
    checksum: null,
    started_at: D('2026-07-10T10:00:00Z'),
    finished_at: null,
    rolled_back_at: null,
  }
}

const BASE: LocalMigration = { name: '000000000000_squashed_migrations', checksum: 'aaa' }
const DOC: LocalMigration = { name: '20260712000000_add_versioned_document_model', checksum: 'bbb' }

describe('evaluateMigrations', () => {
  it('caso 1: todas aplicadas con checksums coincidentes → PASS', () => {
    const r = evaluateMigrations([BASE, DOC], [applied(BASE.name, 'aaa'), applied(DOC.name, 'bbb')])
    expect(r.ok).toBe(true)
    expect(r.problems).toHaveLength(0)
    expect(r.localCount).toBe(2)
  })

  it('caso 2: falta una migración local en remoto → FAIL (MISSING_REMOTE)', () => {
    // Reproduce el incidente: la migración documental existe local pero no en la BD.
    const r = evaluateMigrations([BASE, DOC], [applied(BASE.name, 'aaa')])
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([{ migration: DOC.name, kind: 'MISSING_REMOTE' }])
  })

  it('caso 3: migración con finished_at NULL (intento en curso) → FAIL (FAILED_ATTEMPT)', () => {
    const r = evaluateMigrations([BASE, DOC], [applied(BASE.name, 'aaa'), failedAttempt(DOC.name)])
    expect(r.ok).toBe(false)
    expect(r.problems).toContainEqual({ migration: DOC.name, kind: 'FAILED_ATTEMPT' })
  })

  it('caso 4: migración solo revertida → FAIL (ROLLED_BACK)', () => {
    const r = evaluateMigrations([BASE, DOC], [applied(BASE.name, 'aaa'), rolledBack(DOC.name)])
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([{ migration: DOC.name, kind: 'ROLLED_BACK' }])
  })

  it('caso 5: intento fallido no resuelto en una migración remota-only → FAIL', () => {
    const r = evaluateMigrations(
      [BASE, DOC],
      [applied(BASE.name, 'aaa'), applied(DOC.name, 'bbb'), failedAttempt('99999999999999_other')]
    )
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([{ migration: '99999999999999_other', kind: 'FAILED_ATTEMPT' }])
  })

  it('caso 6: checksum diferente → FAIL (CHECKSUM_MISMATCH)', () => {
    const r = evaluateMigrations([BASE, DOC], [applied(BASE.name, 'aaa'), applied(DOC.name, 'ZZZ')])
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([{ migration: DOC.name, kind: 'CHECKSUM_MISMATCH' }])
  })

  it('caso 7: migraciones históricas remotas adicionales (cola post-squash) → PASS', () => {
    const r = evaluateMigrations(
      [BASE, DOC],
      [
        applied('20260502000000_init_schema', 'x'),
        applied('20260711000000_add_kpi_events', 'y'),
        applied(BASE.name, 'aaa'),
        applied(DOC.name, 'bbb'),
      ]
    )
    expect(r.ok).toBe(true)
    expect(r.problems).toHaveLength(0)
  })

  it('caso 8: varios registros para el mismo nombre (revertido + reaplicado) → PASS', () => {
    // Anomalía real observada en staging: un intento revertido seguido de una aplicación OK.
    const r = evaluateMigrations([BASE], [rolledBack(BASE.name, 'aaa'), applied(BASE.name, 'aaa')])
    expect(r.ok).toBe(true)
  })

  it('caso 8b: intento fallido no resuelto pesa aunque exista una fila aplicada → FAIL', () => {
    const r = evaluateMigrations([BASE], [failedAttempt(BASE.name), applied(BASE.name, 'aaa')])
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([{ migration: BASE.name, kind: 'FAILED_ATTEMPT' }])
  })

  it('caso 9: base sin migraciones (remote vacío) → FAIL, todas MISSING_REMOTE', () => {
    const r = evaluateMigrations([BASE, DOC], [])
    expect(r.ok).toBe(false)
    expect(r.problems.map((p) => p.kind)).toEqual(['MISSING_REMOTE', 'MISSING_REMOTE'])
  })

  it('checksum null en la fila aplicada se trata como no coincidente → FAIL', () => {
    const r = evaluateMigrations([DOC], [{ ...applied(DOC.name, 'bbb'), checksum: null }])
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([{ migration: DOC.name, kind: 'CHECKSUM_MISMATCH' }])
  })
})

describe('resolveGuardMode', () => {
  it('caso 14: VERCEL_ENV=production → activo', () => {
    expect(resolveGuardMode({ VERCEL_ENV: 'production' })).toEqual({
      active: true,
      source: 'vercel-production',
      declaredEnv: 'production',
    })
  })
  it('caso 13: VERCEL_ENV=preview → inactivo (no conecta a remoto)', () => {
    expect(resolveGuardMode({ VERCEL_ENV: 'preview' })).toEqual({
      active: false,
      reason: 'preview',
    })
  })
  it('caso 12: build local sin VERCEL_ENV ni env declarada → inactivo', () => {
    expect(resolveGuardMode({})).toEqual({ active: false, reason: 'local' })
  })
  it('manual: REMOTE_MIGRATION_GUARD_ENV=staging → activo', () => {
    expect(resolveGuardMode({ REMOTE_MIGRATION_GUARD_ENV: 'staging' })).toEqual({
      active: true,
      source: 'manual',
      declaredEnv: 'staging',
    })
  })
  it('manual: REMOTE_MIGRATION_GUARD_ENV=production → activo', () => {
    expect(resolveGuardMode({ REMOTE_MIGRATION_GUARD_ENV: 'production' })).toEqual({
      active: true,
      source: 'manual',
      declaredEnv: 'production',
    })
  })
  it('valor de env declarado inválido → inactivo (local)', () => {
    expect(resolveGuardMode({ REMOTE_MIGRATION_GUARD_ENV: 'prod' })).toEqual({
      active: false,
      reason: 'local',
    })
  })
  it('VERCEL_ENV=production tiene prioridad sobre la env declarada', () => {
    const m = resolveGuardMode({ VERCEL_ENV: 'production', REMOTE_MIGRATION_GUARD_ENV: 'staging' })
    expect(m).toMatchObject({ active: true, source: 'vercel-production' })
  })
})

describe('urlMatchesExpectation (guarda anti-confusión de entornos)', () => {
  const STAGING = 'postgresql://u:p@aws-1-eu-central-1.pooler.supabase.com:5432/postgres' // + ref via user
  it('caso 15: marcador de producción ausente en una URL de staging → FAIL', () => {
    expect(
      urlMatchesExpectation('...postgres.iatuhydsfwoeprpbklod...', 'bbmglaatlyilxutzomxd').ok
    ).toBe(false)
  })
  it('caso 16: marcador de staging ausente en una URL de producción → FAIL', () => {
    expect(
      urlMatchesExpectation('...postgres.bbmglaatlyilxutzomxd...', 'iatuhydsfwoeprpbklod').ok
    ).toBe(false)
  })
  it('coincidencia correcta → OK', () => {
    expect(
      urlMatchesExpectation('...postgres.bbmglaatlyilxutzomxd...', 'bbmglaatlyilxutzomxd').ok
    ).toBe(true)
  })
  it('marcador vacío/indefinido → OK (comprobación opcional)', () => {
    expect(urlMatchesExpectation(STAGING, undefined).ok).toBe(true)
    expect(urlMatchesExpectation(STAGING, '').ok).toBe(true)
  })
})

describe('computeLocalMigrations', () => {
  it('caso 18: reconoce exactamente las dos migraciones actuales del repo con checksum SHA-256', () => {
    const dir = join(process.cwd(), 'prisma', 'migrations')
    const migs = computeLocalMigrations(dir)
    const names = migs.map((m) => m.name)
    expect(names).toContain('000000000000_squashed_migrations')
    expect(names).toContain('20260712000000_add_versioned_document_model')
    // baseline debe ir primero (orden lexicográfico)
    expect(names[0]).toBe('000000000000_squashed_migrations')
    // checksum del fichero documental == el almacenado por Prisma (verificado en prod)
    const doc = migs.find((m) => m.name === '20260712000000_add_versioned_document_model')!
    expect(doc.checksum).toBe('0e28e237ee23e9296ecedf65050c0836a13049981ac96656918f8e402b163535')
    expect(doc.checksum).toMatch(/^[0-9a-f]{64}$/)
  })

  it('directorio inexistente → lista vacía (sin lanzar)', () => {
    expect(computeLocalMigrations(join(process.cwd(), 'prisma', '__no_such_dir__'))).toEqual([])
  })
})

describe('caso 17: los problemas no contienen credenciales (solo nombre + tipo)', () => {
  it('las etiquetas y problemas no incluyen URLs ni secretos', () => {
    const r = evaluateMigrations([DOC], [])
    const serialized = JSON.stringify(r.problems) + JSON.stringify(PROBLEM_LABELS)
    expect(serialized).not.toMatch(/postgres(ql)?:\/\//)
    expect(serialized).not.toMatch(/password|@.*supabase/i)
  })
})
