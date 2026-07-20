/**
 * Errores de dominio de la coordinación de locks (PR I1).
 *
 * Traduce fallos de PostgreSQL y de Prisma a un vocabulario de negocio. Los mensajes son los que
 * puede leer un comercial: nunca contienen SQL, host, usuario, credenciales, códigos de PostgreSQL,
 * detalles de Prisma ni trazas. El error técnico original se conserva en `cause` para observabilidad
 * interna, pero **no es enumerable**: no aparece en `JSON.stringify` ni se serializa por accidente.
 */
import { Prisma } from '@prisma/client'

export type LockErrorCode =
  | 'INVALID_LOCK_ROOT'
  | 'LOCK_TIMEOUT'
  | 'DEADLOCK'
  | 'TRANSACTION_TIMEOUT'
  | 'ROOT_NOT_FOUND'
  | 'INFRA_ERROR'

export const LOCK_ERROR_MESSAGES: Record<LockErrorCode, string> = {
  INVALID_LOCK_ROOT: 'No se ha podido determinar correctamente el registro que debe bloquearse.',
  LOCK_TIMEOUT: 'La operación está siendo utilizada por otro proceso. Inténtalo de nuevo.',
  DEADLOCK: 'La operación no pudo completarse por un conflicto temporal. Inténtalo de nuevo.',
  TRANSACTION_TIMEOUT:
    'La operación ha tardado demasiado y no se ha podido completar. Inténtalo de nuevo.',
  ROOT_NOT_FOUND: 'No se ha encontrado el registro necesario para completar la operación.',
  INFRA_ERROR: 'No se ha podido completar la operación. Inténtalo de nuevo.',
}

/**
 * Fallo esperado de coordinación. No es un error de programación.
 *
 * Los llamantes deben devolver al cliente **solo** `{ code, message }`; `cause` es exclusivamente
 * para observabilidad interna.
 */
export class LockError extends Error {
  readonly code: LockErrorCode

  constructor(code: LockErrorCode, cause?: unknown) {
    super(LOCK_ERROR_MESSAGES[code])
    this.name = 'LockError'
    this.code = code
    // No enumerable: mantiene el error técnico accesible en servidor sin que viaje en un JSON.
    Object.defineProperty(this, 'cause', {
      value: cause,
      enumerable: false,
      writable: false,
      configurable: true,
    })
  }
}

export function isLockError(err: unknown): err is LockError {
  return err instanceof LockError
}

/** `lock_timeout` agotado: otra transacción retiene la fila. */
export const PG_LOCK_NOT_AVAILABLE = '55P03'
/** Deadlock detectado y abortado por PostgreSQL. */
export const PG_DEADLOCK_DETECTED = '40P01'
/** Prisma abortó la transacción interactiva por superar su propio `timeout`. */
export const PRISMA_TRANSACTION_CLOSED = 'P2028'

/** SQLSTATE que este módulo reconoce. Conjunto cerrado a propósito. */
const RECOGNIZED_SQLSTATES = new Set([PG_LOCK_NOT_AVAILABLE, PG_DEADLOCK_DETECTED])

/** Profundidad máxima al recorrer `cause`; acota el coste y corta cadenas patológicas. */
const MAX_CAUSE_DEPTH = 5

/** ¿Es un error emitido por Prisma? Solo en ese caso se admite el respaldo por texto. */
export function isPrismaError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientValidationError
  )
}

/**
 * Devuelve `err` y su cadena de `cause`, sin ciclos y con profundidad acotada.
 * Se materializa como lista (no generador) por el `target` de TypeScript del proyecto.
 */
function causeChain(err: unknown): unknown[] {
  const chain: unknown[] = []
  const seen = new Set<unknown>()
  let current = err

  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth++) {
    if (current == null || typeof current !== 'object') break
    if (seen.has(current)) break // ciclo en `cause`
    seen.add(current)
    chain.push(current)
    current = (current as { cause?: unknown }).cause
  }
  return chain
}

/** SQLSTATE declarado de forma ESTRUCTURADA en un eslabón concreto (nunca por texto). */
function structuredSqlstateOf(link: unknown): string | null {
  if (link instanceof Prisma.PrismaClientKnownRequestError) {
    const metaCode = (link.meta as { code?: unknown } | undefined)?.code
    if (typeof metaCode === 'string' && RECOGNIZED_SQLSTATES.has(metaCode)) return metaCode
  }
  // Errores del driver de PostgreSQL exponen el SQLSTATE directamente en `code`.
  const direct = (link as { code?: unknown }).code
  if (typeof direct === 'string' && RECOGNIZED_SQLSTATES.has(direct)) return direct
  return null
}

/**
 * Extrae el SQLSTATE de un error.
 *
 * Orden de preferencia:
 *   1. código estructurado en el propio error o en su cadena de `cause`;
 *   2. respaldo por texto **solo** si el eslabón es un error de Prisma — algunas versiones dejan el
 *      código del driver únicamente dentro del mensaje.
 *
 * Un `Error` de negocio genérico NUNCA se analiza por texto: que un mensaje comercial contenga
 * «40P01» no puede convertirlo en un deadlock.
 */
export function extractPostgresCode(err: unknown): string | null {
  for (const link of causeChain(err)) {
    const structured = structuredSqlstateOf(link)
    if (structured) return structured
  }
  for (const link of causeChain(err)) {
    if (!isPrismaError(link)) continue
    const message = link instanceof Error ? link.message : ''
    const match = message.match(/\b(55P03|40P01)\b/)
    if (match) return match[1]
  }
  return null
}

/** Código de Prisma (`P….`) del error o de su cadena de `cause`. */
export function extractPrismaCode(err: unknown): string | null {
  for (const link of causeChain(err)) {
    if (link instanceof Prisma.PrismaClientKnownRequestError) return link.code
  }
  return null
}

/**
 * Traduce un fallo ocurrido durante la PREPARACIÓN de los locks (timeouts locales y adquisición).
 * Ahí sí es correcto que un error desconocido se convierta en `INFRA_ERROR`: es maquinaria propia
 * del helper, no código de negocio.
 */
export function toLockError(err: unknown): LockError {
  if (isLockError(err)) return err
  const translated = translateConcurrencyError(err)
  if (isLockError(translated)) return translated
  return new LockError('INFRA_ERROR', err)
}

/**
 * Traduce SOLO los fallos de concurrencia reconocidos, ocurran donde ocurran: preparación,
 * operación de negocio, commit o rollback. Cualquier otro error se devuelve **intacto**.
 *
 * Es lo que permite que `OfferConflictError`, errores de validación o cualquier fallo de dominio
 * lleguen a su llamante sin disfrazarse de error de infraestructura, y a la vez que un deadlock
 * dentro de la operación se comunique con el mismo vocabulario que uno de la fase de bloqueo.
 */
export function translateConcurrencyError(err: unknown): unknown {
  if (isLockError(err)) return err

  const sqlstate = extractPostgresCode(err)
  if (sqlstate === PG_LOCK_NOT_AVAILABLE) return new LockError('LOCK_TIMEOUT', err)
  if (sqlstate === PG_DEADLOCK_DETECTED) return new LockError('DEADLOCK', err)

  // `P2028` es el techo de la transacción en Prisma, distinto de `statement_timeout` (que llega
  // como error de PostgreSQL): la transacción ya estaba cerrada cuando se intentó continuar.
  if (extractPrismaCode(err) === PRISMA_TRANSACTION_CLOSED) {
    return new LockError('TRANSACTION_TIMEOUT', err)
  }

  return err
}

/**
 * PUNTO DE INTEGRACIÓN FUTURO — observabilidad.
 *
 * Cuando el repositorio adopte un patrón claro de reporte para helpers de dominio, aquí es donde
 * deben emitirse `INFRA_ERROR`, `DEADLOCK` y `TRANSACTION_TIMEOUT` a Sentry (con `cause`, sin PII ni
 * credenciales). No se añade ahora para no inventar un patrón que todavía no existe.
 */
