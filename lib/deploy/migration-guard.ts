/**
 * migration-guard — lógica PURA del guard de despliegue Prisma ↔ base de datos.
 *
 * Motivación (incidente 2026-07-15): Vercel desplegó un cliente Prisma que dependía de la
 * migración `20260712000000_add_versioned_document_model`, todavía NO aplicada en la base de
 * datos de producción. El cliente seleccionaba `vehicle_documents.current_version_id` →
 * PostgreSQL respondía `P2022` → las fichas de vendedor/vehículo y entrega reventaban.
 *
 * Este módulo NO accede a la base de datos ni al sistema de ficheros salvo `computeLocalMigrations`
 * (lectura de `prisma/migrations`). La evaluación (`evaluateMigrations`) es una función pura sobre
 * datos planos, testeable con fixtures. El acceso remoto (solo lectura) vive en el script
 * `scripts/check-remote-migrations.ts`.
 *
 * Semántica de `_prisma_migrations` (idéntica a la de `prisma migrate deploy`):
 *  - `finished_at != null` y `rolled_back_at == null`  → aplicada correctamente.
 *  - `finished_at == null` y `rolled_back_at == null`  → intento fallido/incompleto (BLOQUEA).
 *  - `rolled_back_at != null`                           → revertida (no cuenta como aplicada).
 *  El `checksum` almacenado es el SHA-256 hex del contenido de `migration.sql` (verificado en
 *  staging y producción), así que basta con re-hashear el fichero local y comparar.
 *
 * Compatibilidad con el historial real: la base remota conserva las migraciones históricas
 * anteriores al squash + el baseline `000000000000_squashed_migrations`. Esas migraciones
 * remotas que YA NO existen como carpeta local se permiten (no son un error). El guard solo
 * exige que TODA migración presente en el repositorio esté aplicada, finalizada y con checksum
 * coincidente.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Migración local: nombre de carpeta + SHA-256 hex del contenido de `migration.sql`. */
export type LocalMigration = { name: string; checksum: string }

/** Fila (subconjunto relevante) de `_prisma_migrations`. */
export type RemoteMigrationRow = {
  migration_name: string
  checksum: string | null
  started_at: Date | null
  finished_at: Date | null
  rolled_back_at: Date | null
}

export type ProblemKind =
  | 'MISSING_REMOTE' // la migración local no está registrada en la base remota
  | 'ROLLED_BACK' // la migración local solo consta como revertida
  | 'FAILED_ATTEMPT' // hay un intento no finalizado ni revertido (Prisma lo trata como fallido)
  | 'CHECKSUM_MISMATCH' // aplicada, pero el checksum remoto no coincide con el fichero local

export type MigrationProblem = { migration: string; kind: ProblemKind }

export type Evaluation = {
  ok: boolean
  problems: MigrationProblem[]
  localCount: number
  remoteCount: number
}

/** Mensajes legibles por tipo de problema (sin secretos, sin URLs). */
export const PROBLEM_LABELS: Record<ProblemKind, string> = {
  MISSING_REMOTE: 'no aplicada en la base de datos remota',
  ROLLED_BACK: 'consta como revertida (rolled back), no aplicada',
  FAILED_ATTEMPT: 'intento de migración no finalizado ni revertido (estado fallido)',
  CHECKSUM_MISMATCH: 'el checksum remoto no coincide con el fichero local',
}

/**
 * Evalúa la coherencia entre las migraciones locales y las filas de `_prisma_migrations`.
 * Función PURA: no lee ficheros ni red. `ok === true` ⟺ es seguro desplegar código dependiente.
 */
export function evaluateMigrations(
  local: LocalMigration[],
  remote: RemoteMigrationRow[]
): Evaluation {
  const problems: MigrationProblem[] = []

  // Intentos fallidos (finished_at NULL ∧ rolled_back_at NULL): bloquean globalmente, sean o no
  // de una migración presente localmente. Prisma migrate deploy también se negaría.
  const failed = new Set<string>()
  for (const r of remote) {
    if (r.finished_at == null && r.rolled_back_at == null) failed.add(r.migration_name)
  }
  for (const name of Array.from(failed).sort()) {
    problems.push({ migration: name, kind: 'FAILED_ATTEMPT' })
  }

  for (const lm of local) {
    if (failed.has(lm.name)) continue // ya reportada como FAILED_ATTEMPT
    const rows = remote.filter((r) => r.migration_name === lm.name)
    const applied = rows.find((r) => r.finished_at != null && r.rolled_back_at == null)
    if (!applied) {
      problems.push({
        migration: lm.name,
        kind: rows.length > 0 ? 'ROLLED_BACK' : 'MISSING_REMOTE',
      })
      continue
    }
    if ((applied.checksum ?? '') !== lm.checksum) {
      problems.push({ migration: lm.name, kind: 'CHECKSUM_MISMATCH' })
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    localCount: local.length,
    remoteCount: remote.length,
  }
}

/**
 * Lee `prisma/migrations`, calcula el SHA-256 hex del contenido de cada `migration.sql` y
 * devuelve las migraciones locales ordenadas por nombre. Ignora carpetas sin `migration.sql`
 * y el fichero `migration_lock.toml`. No accede a la red.
 */
export function computeLocalMigrations(migrationsDir: string): LocalMigration[] {
  if (!existsSync(migrationsDir)) return []
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .flatMap((name) => {
      const sql = join(migrationsDir, name, 'migration.sql')
      if (!existsSync(sql)) return []
      // Hash de bytes crudos: idéntico al checksum que almacena Prisma (repo con EOL=LF forzado).
      const checksum = createHash('sha256').update(readFileSync(sql)).digest('hex')
      return [{ name, checksum }]
    })
}

// ─── Resolución de modo (pura) ────────────────────────────────────────────────

export type GuardMode =
  | { active: true; source: 'vercel-production' | 'manual'; declaredEnv: 'production' | 'staging' }
  | { active: false; reason: 'preview' | 'local' }

/**
 * Decide si el guard debe conectarse a la base remota, a partir del entorno.
 *  - `VERCEL_ENV=production`  → activo (build de producción de Vercel).
 *  - `VERCEL_ENV` presente y ≠ production (p. ej. `preview`) → inactivo: NO se conecta a remoto.
 *  - Sin `VERCEL_ENV`: activo solo si `REMOTE_MIGRATION_GUARD_ENV` declara staging|production
 *    (uso manual explícito). En cualquier otro caso (build local) → inactivo.
 */
export function resolveGuardMode(env: {
  VERCEL_ENV?: string
  REMOTE_MIGRATION_GUARD_ENV?: string
}): GuardMode {
  const vercelEnv = env.VERCEL_ENV
  if (vercelEnv === 'production') {
    return { active: true, source: 'vercel-production', declaredEnv: 'production' }
  }
  if (vercelEnv) {
    // preview (o cualquier otro entorno Vercel que no sea production)
    return { active: false, reason: 'preview' }
  }
  const declared = env.REMOTE_MIGRATION_GUARD_ENV
  if (declared === 'production' || declared === 'staging') {
    return { active: true, source: 'manual', declaredEnv: declared }
  }
  return { active: false, reason: 'local' }
}

/**
 * Guarda anti-confusión de entornos: la URL resuelta DEBE contener `expectContains` (un marcador
 * inequívoco del entorno declarado, p. ej. el project ref). Nunca devuelve ni registra la URL.
 * Si `expectContains` está vacío/indefinido, devuelve `{ ok: true }` (comprobación opcional).
 */
export function urlMatchesExpectation(
  url: string,
  expectContains: string | undefined | null
): { ok: boolean } {
  if (!expectContains) return { ok: true }
  return { ok: url.includes(expectContains) }
}

// ─── Preflight (puro): decide SKIP / FAIL / CONNECT sin abrir ninguna conexión ─

export type GuardEnv = {
  VERCEL_ENV?: string
  REMOTE_MIGRATION_GUARD_ENV?: string
  REMOTE_MIGRATION_GUARD_DATABASE_URL?: string
  DIRECT_URL?: string
  DATABASE_URL?: string
  REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS?: string
}

export type FailReason = 'missing-url' | 'missing-marker' | 'env-mismatch'

export type Preflight =
  | { action: 'skip'; reason: 'preview' | 'local' }
  | { action: 'fail'; reason: FailReason; declaredEnv: 'production' | 'staging' }
  /** `url` es de uso interno para abrir la conexión read-only; NUNCA se registra. */
  | { action: 'connect'; url: string; declaredEnv: 'production' | 'staging' }

/**
 * Decide, sin efectos y sin abrir conexión, qué debe hacer el guard.
 *
 * Endurecimiento: cuando el guard está **activo** (Vercel `production` o modo manual), el marcador
 * de identidad `REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS` es **obligatorio** — su ausencia es
 * `fail` (no se abre conexión). Así, una URL de staging mal configurada en Production no puede
 * validar la base equivocada. La URL se elige con la prioridad
 * `REMOTE_MIGRATION_GUARD_DATABASE_URL → DIRECT_URL → DATABASE_URL` (no obliga a crear una nueva).
 */
export function preflight(env: GuardEnv): Preflight {
  const mode = resolveGuardMode(env)
  if (!mode.active) return { action: 'skip', reason: mode.reason }

  const url = env.REMOTE_MIGRATION_GUARD_DATABASE_URL || env.DIRECT_URL || env.DATABASE_URL || ''
  if (!url) return { action: 'fail', reason: 'missing-url', declaredEnv: mode.declaredEnv }

  const expect = env.REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS
  if (!expect) return { action: 'fail', reason: 'missing-marker', declaredEnv: mode.declaredEnv }
  if (!urlMatchesExpectation(url, expect).ok) {
    return { action: 'fail', reason: 'env-mismatch', declaredEnv: mode.declaredEnv }
  }
  return { action: 'connect', url, declaredEnv: mode.declaredEnv }
}

/** Mensajes seguros por causa de FAIL de configuración (sin URL/host/credenciales). */
export const FAIL_REASON_LABELS: Record<FailReason, string> = {
  'missing-url':
    'falta la URL de base de datos (REMOTE_MIGRATION_GUARD_DATABASE_URL / DIRECT_URL / DATABASE_URL)',
  'missing-marker':
    'falta la guarda de identidad del entorno: define REMOTE_MIGRATION_GUARD_EXPECT_URL_CONTAINS (obligatorio cuando el guard está activo)',
  'env-mismatch':
    'la URL resuelta no corresponde al entorno declarado (marcador de identidad no encontrado); no se abre ninguna conexión',
}

// ─── Sanitización de errores (nunca expone host/URL/credenciales) ──────────────

/**
 * Devuelve un token SEGURO para un error de conexión/consulta: el código de Prisma (`P####`) si
 * existe, `TIMEOUT` si el error es de timeout, o `UNKNOWN`. **Nunca** devuelve el mensaje, el host,
 * el usuario, la contraseña ni la URL — solo se usa el mensaje para detectar el patrón de timeout.
 */
export function safeErrorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code
  if (typeof code === 'string' && /^P\d{3,4}$/.test(code)) return code
  const msg = err instanceof Error ? err.message : ''
  if (/timeout/i.test(msg)) return 'TIMEOUT'
  return 'UNKNOWN'
}

/** Cadena SEGURA para un fallo de verificación remota: solo código + entorno. */
export function describeConnectionFailure(declaredEnv: string, err: unknown): string {
  return `no se pudo verificar el estado remoto de migraciones. code=${safeErrorCode(err)} · environment=${declaredEnv}`
}
