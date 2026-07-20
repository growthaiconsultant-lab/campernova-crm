/**
 * Errores de dominio de la coordinación de locks (PR I1).
 *
 * Traduce fallos de PostgreSQL a un vocabulario de negocio. Los mensajes son los que puede leer
 * un comercial: nunca contienen SQL, host, usuario, credenciales, códigos de PostgreSQL, detalles
 * de Prisma ni trazas. El error técnico original se conserva en `cause` para observabilidad
 * interna, pero no viaja al cliente.
 */
import { Prisma } from '@prisma/client'

export type LockErrorCode = 'LOCK_TIMEOUT' | 'DEADLOCK' | 'ROOT_NOT_FOUND' | 'INFRA_ERROR'

export const LOCK_ERROR_MESSAGES: Record<LockErrorCode, string> = {
  LOCK_TIMEOUT: 'La operación está siendo utilizada por otro proceso. Inténtalo de nuevo.',
  DEADLOCK: 'La operación no pudo completarse por un conflicto temporal. Inténtalo de nuevo.',
  ROOT_NOT_FOUND: 'No se ha encontrado el registro necesario para completar la operación.',
  INFRA_ERROR: 'No se ha podido completar la operación. Inténtalo de nuevo.',
}

/** Fallo esperado de coordinación. No es un error de programación. */
export class LockError extends Error {
  readonly code: LockErrorCode
  /** Error original, solo para observabilidad interna. Nunca se muestra al usuario. */
  readonly cause?: unknown

  constructor(code: LockErrorCode, cause?: unknown) {
    super(LOCK_ERROR_MESSAGES[code])
    this.name = 'LockError'
    this.code = code
    this.cause = cause
  }
}

export function isLockError(err: unknown): err is LockError {
  return err instanceof LockError
}

/** `lock_timeout` agotado: otra transacción retiene la fila. */
const PG_LOCK_NOT_AVAILABLE = '55P03'
/** Deadlock detectado y abortado por PostgreSQL. */
const PG_DEADLOCK_DETECTED = '40P01'

/**
 * Extrae el código SQLSTATE de un error de Prisma.
 *
 * Prisma envuelve los fallos de consulta cruda en `P2010` y deja el código real del driver en
 * `meta.code`; en algunas versiones solo aparece dentro del mensaje. Se comprueban ambos para no
 * depender de un detalle interno de Prisma.
 */
export function extractPostgresCode(err: unknown): string | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const metaCode = (err.meta as { code?: unknown } | undefined)?.code
    if (typeof metaCode === 'string' && metaCode) return metaCode
  }
  const message = err instanceof Error ? err.message : ''
  const match = message.match(/\b(55P03|40P01)\b/)
  return match ? match[1] : null
}

/**
 * Traduce un fallo ocurrido DURANTE la fase de bloqueo.
 *
 * Solo se aplica a los errores del propio protocolo (timeouts locales y adquisición de locks).
 * Los errores que lance la operación de negocio NO pasan por aquí: deben llegar intactos a su
 * llamante, porque envolverlos ocultaría conflictos de dominio legítimos.
 */
export function toLockError(err: unknown): LockError {
  if (isLockError(err)) return err

  const pgCode = extractPostgresCode(err)
  if (pgCode === PG_LOCK_NOT_AVAILABLE) return new LockError('LOCK_TIMEOUT', err)
  if (pgCode === PG_DEADLOCK_DETECTED) return new LockError('DEADLOCK', err)

  return new LockError('INFRA_ERROR', err)
}

/**
 * PUNTO DE INTEGRACIÓN FUTURO — observabilidad.
 *
 * Cuando el repositorio adopte un patrón claro de reporte para helpers de dominio, aquí es donde
 * debe emitirse `INFRA_ERROR` y `DEADLOCK` a Sentry (con `cause`, sin PII ni credenciales).
 * No se añade ahora para no inventar un patrón que todavía no existe.
 */
