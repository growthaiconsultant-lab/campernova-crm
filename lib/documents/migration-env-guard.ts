/**
 * PR5B3 — Guard de entorno para auditoría/backfill de documentos (PURO, no conecta, no imprime
 * la URL). Cruza el entorno DECLARADO (`--env local|staging|production`) con la URL REAL de DB y
 * exige variables de autorización específicas por entorno y operación. Impide, por diseño:
 *  - ejecutar contra staging/producción sin autorización explícita;
 *  - declarar `staging` cuando la URL es de producción (o al revés);
 *  - cualquier fallback silencioso a remoto.
 *
 * Este guard NO ejecuta nada: solo decide si el destino es admisible y devuelve la URL validada.
 * En PR5B3 no se invoca contra staging ni producción.
 */

/** Refs de proyecto Supabase de staging y producción (mismos que el guard de integración). */
export const STAGING_DB_REF = 'iatuhydsfwoeprpbklod'
export const PRODUCTION_DB_REF = 'bbmglaatlyilxutzomxd'
export const MANAGED_HOST_FRAGMENTS = ['.supabase.co', '.pooler.supabase.com'] as const
const LOCAL_HOST = /@(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\]|::1)(:\d+)?\//i
const LOCAL_HTTP = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:\d+)?/i

export type MigrationEnv = 'local' | 'staging' | 'production'
export type MigrationOperation = 'audit' | 'backfill'

export class MigrationGuardError extends Error {
  constructor(message: string) {
    super(`[document-migration-guard] ${message}`)
    this.name = 'MigrationGuardError'
  }
}

export type ResolveArgs = {
  env: MigrationEnv
  operation: MigrationOperation
  processEnv: Record<string, string | undefined>
  /** Confirmación adicional (segunda confirmación para producción). */
  confirm?: string
}

/** Segunda confirmación OBLIGATORIA para producción (además del `--confirm` del script). */
export const PRODUCTION_ACK = 'I_UNDERSTAND_THIS_IS_PRODUCTION'

function allowVarName(env: MigrationEnv, operation: MigrationOperation): string {
  const scope = env === 'staging' ? 'STAGING' : 'PRODUCTION'
  const op = operation === 'audit' ? 'AUDIT' : 'BACKFILL'
  return `ALLOW_${scope}_DOCUMENT_${op}`
}

function resolveUrl(processEnv: Record<string, string | undefined>): string {
  const url = processEnv.DATABASE_URL || processEnv.DIRECT_URL
  if (!url || url.trim() === '') {
    throw new MigrationGuardError('no hay DATABASE_URL/DIRECT_URL definida.')
  }
  return url
}

/**
 * Valida el destino y devuelve `{ url, env }` o lanza `MigrationGuardError`. Nunca incluye la URL
 * en el mensaje de error (solo el motivo).
 */
export function resolveMigrationTarget(args: ResolveArgs): { url: string; env: MigrationEnv } {
  const url = resolveUrl(args.processEnv)
  const lower = url.toLowerCase()
  const isLocal = LOCAL_HOST.test(url)
  const hasStagingRef = lower.includes(STAGING_DB_REF)
  const hasProdRef = lower.includes(PRODUCTION_DB_REF)
  const hasManagedHost = MANAGED_HOST_FRAGMENTS.some((f) => lower.includes(f))

  if (args.env === 'local') {
    if (hasStagingRef || hasProdRef) {
      throw new MigrationGuardError(
        '--env local pero la URL apunta a una ref de staging/producción.'
      )
    }
    if (hasManagedHost) {
      throw new MigrationGuardError(
        '--env local pero la URL apunta a un host gestionado de Supabase.'
      )
    }
    if (!isLocal) {
      throw new MigrationGuardError('--env local requiere una URL local (127.0.0.1/localhost).')
    }
    return { url, env: 'local' }
  }

  // staging / production: exigir la variable de autorización específica.
  const allowVar = allowVarName(args.env, args.operation)
  if (args.processEnv[allowVar] !== 'true') {
    throw new MigrationGuardError(`operación bloqueada: se requiere ${allowVar}=true.`)
  }

  if (args.env === 'staging') {
    if (hasProdRef) throw new MigrationGuardError('--env staging pero la URL es de PRODUCCIÓN.')
    if (!hasStagingRef) {
      throw new MigrationGuardError(
        '--env staging pero la URL no corresponde al proyecto de staging.'
      )
    }
    return { url, env: 'staging' }
  }

  // production
  if (args.confirm !== PRODUCTION_ACK) {
    throw new MigrationGuardError(
      `producción requiere una segunda confirmación exacta (--ack ${PRODUCTION_ACK}).`
    )
  }
  if (hasStagingRef) throw new MigrationGuardError('--env production pero la URL es de STAGING.')
  if (!hasProdRef) {
    throw new MigrationGuardError(
      '--env production pero la URL no corresponde al proyecto de producción.'
    )
  }
  return { url, env: 'production' }
}

/**
 * Valida el ENDPOINT de Supabase Storage (`NEXT_PUBLIC_SUPABASE_URL`) contra el entorno declarado,
 * con las mismas reglas que la DB. Nunca imprime la URL. Devuelve `{ supabaseUrl, env }` o lanza.
 * En PR5B3 la auditoría de Storage solo se ejecuta contra local/CI.
 */
export function resolveStorageTarget(args: ResolveArgs): {
  supabaseUrl: string
  env: MigrationEnv
} {
  const supabaseUrl = args.processEnv.NEXT_PUBLIC_SUPABASE_URL || args.processEnv.SUPABASE_URL
  if (!supabaseUrl || supabaseUrl.trim() === '') {
    throw new MigrationGuardError('no hay NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL definida.')
  }
  const lower = supabaseUrl.toLowerCase()
  const isLocal = LOCAL_HTTP.test(supabaseUrl)
  const hasStagingRef = lower.includes(STAGING_DB_REF)
  const hasProdRef = lower.includes(PRODUCTION_DB_REF)
  const hasManagedHost = MANAGED_HOST_FRAGMENTS.some((f) => lower.includes(f))

  if (args.env === 'local') {
    if (hasStagingRef || hasProdRef || hasManagedHost) {
      throw new MigrationGuardError('--env local pero el endpoint de Storage no es local.')
    }
    if (!isLocal)
      throw new MigrationGuardError('--env local requiere un endpoint de Storage local.')
    return { supabaseUrl, env: 'local' }
  }

  const allowVar = allowVarName(args.env, args.operation)
  if (args.processEnv[allowVar] !== 'true') {
    throw new MigrationGuardError(`operación bloqueada: se requiere ${allowVar}=true.`)
  }
  if (args.env === 'staging') {
    if (hasProdRef)
      throw new MigrationGuardError('--env staging pero el endpoint es de PRODUCCIÓN.')
    if (!hasStagingRef)
      throw new MigrationGuardError('--env staging pero el endpoint no es de staging.')
    return { supabaseUrl, env: 'staging' }
  }
  if (args.confirm !== PRODUCTION_ACK) {
    throw new MigrationGuardError(`producción requiere --ack ${PRODUCTION_ACK}.`)
  }
  if (hasStagingRef)
    throw new MigrationGuardError('--env production pero el endpoint es de STAGING.')
  if (!hasProdRef)
    throw new MigrationGuardError('--env production pero el endpoint no es de producción.')
  return { supabaseUrl, env: 'production' }
}
