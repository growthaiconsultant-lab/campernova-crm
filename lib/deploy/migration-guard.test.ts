import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import {
  evaluateMigrations,
  computeLocalMigrations,
  resolveGuardMode,
  urlMatchesExpectation,
  preflight,
  safeErrorCode,
  describeConnectionFailure,
  FAIL_REASON_LABELS,
  PROBLEM_LABELS,
  type LocalMigration,
  type RemoteMigrationRow,
} from './migration-guard'

const PROD_URL =
  'postgresql://postgres.bbmglaatlyilxutzomxd:PWD@aws-1-eu-central-1.pooler.supabase.com:5432/postgres'
const PROD_DBURL =
  'postgresql://postgres.bbmglaatlyilxutzomxd:PWD@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
const STG_URL =
  'postgresql://postgres.iatuhydsfwoeprpbklod:PWD@aws-1-eu-central-1.pooler.supabase.com:5432/postgres'
const PROD_REF = 'bbmglaatlyilxutzomxd'

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

// ─── Preflight: identidad de entorno OBLIGATORIA cuando el guard está activo ────

describe('preflight — decisión sin abrir conexión', () => {
  it('caso 5 (endurecido): VERCEL_ENV=production SIN marcador → fail missing-marker (no connect)', () => {
    const p = preflight({ VERCEL_ENV: 'production', DIRECT_URL: PROD_URL })
    expect(p).toEqual({ action: 'fail', reason: 'missing-marker', declaredEnv: 'production' })
  })

  it('caso 2: producción con marcador INCORRECTO → fail env-mismatch (no connect)', () => {
    // URL de staging colada como producción: el marcador de prod no aparece → NO se conecta.
    const p = preflight({
      VERCEL_ENV: 'production',
      DIRECT_URL: STG_URL,
      REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS: PROD_REF,
    })
    expect(p).toEqual({ action: 'fail', reason: 'env-mismatch', declaredEnv: 'production' })
  })

  it('caso 3: producción con marcador correcto + DIRECT_URL → connect usando DIRECT_URL', () => {
    const p = preflight({
      VERCEL_ENV: 'production',
      DIRECT_URL: PROD_URL,
      REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS: PROD_REF,
    })
    expect(p).toEqual({ action: 'connect', url: PROD_URL, declaredEnv: 'production' })
  })

  it('caso 4: producción sin DIRECT_URL, con DATABASE_URL válida → connect (fallback)', () => {
    const p = preflight({
      VERCEL_ENV: 'production',
      DATABASE_URL: PROD_DBURL,
      REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS: PROD_REF,
    })
    expect(p).toEqual({ action: 'connect', url: PROD_DBURL, declaredEnv: 'production' })
  })

  it('prioridad de URL: REMOTE_MIGRATION_GUARD_DATABASE_URL gana a DIRECT_URL y DATABASE_URL', () => {
    const p = preflight({
      REMOTE_MIGRATION_GUARD_ENV: 'staging',
      REMOTE_MIGRATION_GUARD_DATABASE_URL: STG_URL,
      DIRECT_URL: PROD_URL,
      DATABASE_URL: PROD_DBURL,
      REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS: 'iatuhydsfwoeprpbklod',
    })
    expect(p).toMatchObject({ action: 'connect', url: STG_URL, declaredEnv: 'staging' })
  })

  it('producción activa sin URL → fail missing-url', () => {
    const p = preflight({
      VERCEL_ENV: 'production',
      REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS: PROD_REF,
    })
    expect(p).toEqual({ action: 'fail', reason: 'missing-url', declaredEnv: 'production' })
  })

  it('manual sin marcador → fail missing-marker', () => {
    const p = preflight({ REMOTE_MIGRATION_GUARD_ENV: 'staging', DIRECT_URL: STG_URL })
    expect(p).toEqual({ action: 'fail', reason: 'missing-marker', declaredEnv: 'staging' })
  })

  it('caso 5 (Preview): VERCEL_ENV=preview con TODAS las variables → skip (no connect, no marcador)', () => {
    const p = preflight({
      VERCEL_ENV: 'preview',
      DIRECT_URL: PROD_URL,
      DATABASE_URL: PROD_DBURL,
      REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS: PROD_REF,
    })
    expect(p).toEqual({ action: 'skip', reason: 'preview' })
  })

  it('build local (sin VERCEL_ENV ni env manual) → skip local', () => {
    expect(preflight({ DIRECT_URL: PROD_URL })).toEqual({ action: 'skip', reason: 'local' })
  })

  it('los mensajes de FAIL no contienen URL/host/credenciales', () => {
    const blob = JSON.stringify(FAIL_REASON_LABELS)
    expect(blob).not.toMatch(/postgres(ql)?:\/\//)
    expect(blob).not.toMatch(/supabase|password|@|:\d{4}/i)
  })
})

// ─── Sanitización de errores de conexión ───────────────────────────────────────

describe('safeErrorCode / describeConnectionFailure — sin fuga de secretos', () => {
  it('devuelve el código Prisma (P####) si existe', () => {
    expect(safeErrorCode(Object.assign(new Error('boom'), { code: 'P1001' }))).toBe('P1001')
    expect(safeErrorCode(Object.assign(new Error('x'), { code: 'P2022' }))).toBe('P2022')
  })
  it('detecta timeout sin devolver el mensaje', () => {
    expect(safeErrorCode(new Error('timeout tras 15000ms (consulta)'))).toBe('TIMEOUT')
  })
  it('desconocido → UNKNOWN', () => {
    expect(safeErrorCode(new Error('algo raro'))).toBe('UNKNOWN')
    expect(safeErrorCode(null)).toBe('UNKNOWN')
  })
  it('caso 6: un error cuyo mensaje contiene host/puerto/usuario/password/URL NO se filtra', () => {
    const leaky = Object.assign(
      new Error(
        "Can't reach database server at `postgres.bbmglaatlyilxutzomxd:SUPERSECRET@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`"
      ),
      { code: 'P1001' }
    )
    const out = describeConnectionFailure('production', leaky)
    expect(out).toBe(
      'no se pudo verificar el estado remoto de migraciones. code=P1001 · environment=production'
    )
    for (const secret of [
      'SUPERSECRET',
      'postgres.bbmglaatlyilxutzomxd',
      'aws-1-eu-central-1.pooler.supabase.com',
      ':5432',
      'postgresql://',
      "Can't reach",
    ]) {
      expect(out).not.toContain(secret)
    }
  })
})
