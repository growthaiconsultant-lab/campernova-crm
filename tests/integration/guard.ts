/**
 * Guard de seguridad de la infraestructura de tests de integración (PR0).
 *
 * Impide que los tests de integración (que aplican migraciones, escriben y limpian
 * datos) se ejecuten JAMÁS contra staging o producción. La lógica es pura y testeable
 * con strings controlados (ver `guard.test.ts`) — no abre ninguna conexión.
 *
 * Reglas:
 *  - La URL debe venir de `TEST_DATABASE_URL` (variable explícita de test); nunca se
 *    reutiliza `DATABASE_URL`/`DIRECT_URL` del entorno del desarrollador de forma implícita.
 *  - La URL NO puede contener las refs conocidas de staging/producción.
 *  - `NODE_ENV` debe ser `test`.
 *  - Para operaciones destructivas (migrar/reset/truncate) se exige además
 *    `ALLOW_INTEGRATION_DB_RESET=true`.
 *
 * El guard nunca imprime la URL ni credenciales: solo describe el motivo del rechazo.
 */

/** Project refs de staging y producción — valores PROHIBIDOS como destino de tests. */
export const FORBIDDEN_DB_REFS = ['iatuhydsfwoeprpbklod', 'bbmglaatlyilxutzomxd'] as const

/** Fragmentos de host de Supabase gestionado que tampoco deben usarse como DB de test. */
export const FORBIDDEN_HOST_FRAGMENTS = ['.supabase.co', '.pooler.supabase.com'] as const

export type GuardEnv = {
  nodeEnv?: string
  allowReset?: string
}

export type GuardOptions = {
  /** Si true, exige `ALLOW_INTEGRATION_DB_RESET=true` (operaciones destructivas). */
  requireReset?: boolean
}

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeTestDatabaseError'
  }
}

/**
 * Devuelve el motivo por el que `url` NO es una base de datos de test segura, o `null`
 * si es segura. Función pura: no conecta, no lee `process.env`, no imprime la URL.
 */
export function findUnsafeReason(
  url: string | undefined | null,
  env: GuardEnv = {},
  options: GuardOptions = {}
): string | null {
  if (!url || url.trim() === '') {
    return 'TEST_DATABASE_URL no está definida. Define una base de datos de test efímera.'
  }

  const lower = url.toLowerCase()

  for (const ref of FORBIDDEN_DB_REFS) {
    if (lower.includes(ref)) {
      return 'La URL apunta a una ref PROHIBIDA (staging o producción). Operación abortada.'
    }
  }

  for (const fragment of FORBIDDEN_HOST_FRAGMENTS) {
    if (lower.includes(fragment)) {
      return 'La URL apunta a un host de Supabase gestionado (staging/producción). Usa una base de datos de test efímera.'
    }
  }

  if (env.nodeEnv !== 'test') {
    return "NODE_ENV debe ser 'test' para ejecutar la infraestructura de integración."
  }

  if (options.requireReset && env.allowReset !== 'true') {
    return 'Operación destructiva bloqueada: se requiere ALLOW_INTEGRATION_DB_RESET=true.'
  }

  return null
}

/** Igual que `findUnsafeReason` pero booleano. */
export function isSafeTestDatabaseUrl(
  url: string | undefined | null,
  env: GuardEnv = {},
  options: GuardOptions = {}
): boolean {
  return findUnsafeReason(url, env, options) === null
}

/**
 * Lanza `UnsafeTestDatabaseError` si `url` no es una base de datos de test segura.
 * `asserts` estrecha el tipo de `url` a `string` cuando no lanza.
 */
export function assertSafeTestDatabaseUrl(
  url: string | undefined | null,
  env: GuardEnv = {},
  options: GuardOptions = {}
): asserts url is string {
  const reason = findUnsafeReason(url, env, options)
  if (reason) {
    throw new UnsafeTestDatabaseError(`[integration-guard] ${reason}`)
  }
}

/**
 * Resuelve la URL de test desde el entorno del proceso y la valida. Devuelve la URL
 * (segura) o lanza. Wrapper impuro sobre `assertSafeTestDatabaseUrl`.
 */
export function requireTestDatabaseUrl(
  processEnv: NodeJS.ProcessEnv = process.env,
  options: GuardOptions = {}
): string {
  const url = processEnv.TEST_DATABASE_URL
  assertSafeTestDatabaseUrl(
    url,
    { nodeEnv: processEnv.NODE_ENV, allowReset: processEnv.ALLOW_INTEGRATION_DB_RESET },
    options
  )
  return url
}
