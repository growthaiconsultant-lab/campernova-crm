/**
 * Coordinación de locks de filas raíz (PR I1).
 *
 * ⚠️ INERTE: ningún flujo de negocio lo usa todavía. Este PR construye y demuestra el mecanismo;
 * conectarlo a ofertas, reservas, entregas, calendario, próxima acción, estado de vehículo,
 * tasación y archivado corresponde a I2/I3/I4 y a B2 final.
 *
 * ⚠️ `I1 DOES NOT ENFORCE THE ARCHIVING INVARIANT BY ITSELF`. Mientras los escritores no adopten
 * el protocolo, un flujo que no bloquee la raíz seguirá pudiendo crear una dependencia en paralelo.
 *
 * Protocolo:
 *   1. normalizar las raíces (deduplicar + ordenar globalmente);
 *   2. abrir una transacción interactiva (`READ COMMITTED`, el aislamiento por defecto);
 *   3. fijar `lock_timeout` y `statement_timeout` con `SET LOCAL` — solo para esta transacción;
 *   4. adquirir `SELECT … FOR UPDATE` sobre cada raíz, en orden;
 *   5. ejecutar la operación con el cliente transaccional;
 *   6. cerrar.
 *
 * La exclusión la dan los row locks explícitos, no el nivel de aislamiento: `Serializable` no
 * sirve aquí porque PostgreSQL solo vigila anomalías entre transacciones que TAMBIÉN son
 * serializables, y los escritores del CRM corren en `READ COMMITTED`.
 *
 * `NO EXTERNAL EFFECTS INSIDE LOCKED TRANSACTION` — este módulo no importa email, caché de Next,
 * eventos de KPI, matching, UI ni ningún módulo de negocio, y no acepta callbacks para ellos.
 * Los efectos externos son responsabilidad del llamante, DESPUÉS de que la transacción confirme:
 * mantenerlos dentro alargaría la retención de los locks tanto como tarde un servicio externo.
 */
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { LockError, toLockError, translateConcurrencyError } from './errors'
import { ROOT_TABLES, normalizeRoots } from './roots'
import type { LockCapableClient, LockOptions, LockRoot } from './types'

/** Espera máxima por una fila ocupada. Corta frente a la paciencia de un usuario. */
export const DEFAULT_LOCK_TIMEOUT_MS = 3_000
/** Techo por sentencia. Holgado frente a transacciones de milisegundos. */
export const DEFAULT_STATEMENT_TIMEOUT_MS = 10_000
/**
 * Techo de la transacción en Prisma. Debe superar `statement_timeout` para que sea PostgreSQL
 * quien aborte primero y podamos traducir el fallo a un código de dominio.
 */
export const DEFAULT_TRANSACTION_TIMEOUT_MS = 15_000
/** Espera máxima por una conexión libre del pool antes de empezar. */
export const DEFAULT_MAX_WAIT_MS = 10_000

/** Cota superior de los timeouts configurables; evita fijar valores absurdos por error. */
const MAX_TIMEOUT_MS = 60_000

function assertTimeout(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_TIMEOUT_MS) {
    throw new TypeError(`${name} debe ser un entero de milisegundos entre 1 y ${MAX_TIMEOUT_MS}`)
  }
  return value
}

/**
 * Fija los timeouts SOLO para esta transacción. `SET LOCAL` se revierte al terminar, así que no
 * altera la configuración del servidor ni contamina la siguiente transacción de la conexión.
 *
 * PostgreSQL no admite parámetros en `SET`, por lo que el valor se interpola; es seguro porque
 * `assertTimeout` ya ha garantizado que es un entero y nunca procede de entrada del cliente.
 */
async function applyLocalTimeouts(
  tx: Prisma.TransactionClient,
  lockTimeoutMs: number,
  statementTimeoutMs: number
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = ${Prisma.raw(String(lockTimeoutMs))}`)
  await tx.$executeRaw(
    Prisma.sql`SET LOCAL statement_timeout = ${Prisma.raw(String(statementTimeoutMs))}`
  )
}

/**
 * Bloquea una fila raíz. La tabla sale del mapping cerrado `ROOT_TABLES` indexado por un tipo
 * literal; el identificador viaja SIEMPRE como parámetro. No se concatena SQL ni se usa
 * `$queryRawUnsafe`.
 *
 * Si la fila no existe se aborta con `ROOT_NOT_FOUND`: seguir adelante sin ella significaría
 * ejecutar la operación sin la exclusión que se había pedido.
 */
async function lockRoot(tx: Prisma.TransactionClient, root: LockRoot): Promise<void> {
  const table = ROOT_TABLES[root.type]
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT id FROM ${Prisma.raw(table)} WHERE id = ${root.id} FOR UPDATE`
  )
  if (rows.length === 0) throw new LockError('ROOT_NOT_FOUND')
}

/**
 * Ejecuta `operation` con las raíces indicadas bloqueadas, en el orden global.
 *
 * **Fail-closed**: la validación de las raíces ocurre ANTES de abrir la transacción. Una raíz
 * inválida (tipo ajeno, `id` que no es cadena, vacío o solo espacios) aborta con
 * `INVALID_LOCK_ROOT` sin emitir SQL y sin ejecutar `operation`. Un duplicado válido sí se colapsa
 * en una sola adquisición.
 *
 * Con `roots` vacío no se ejecuta SQL de bloqueo, pero la operación sigue corriendo dentro de una
 * transacción: un llamante cuyo caso no tenga raíz operativa (por ejemplo un evento de calendario
 * sin vínculos) conserva la atomicidad sin tratar ese caso como especial. Una lista **no** vacía
 * nunca se convierte en vacía en silencio.
 *
 * Contrato de errores:
 *   - los fallos de concurrencia reconocidos (`55P03`, `40P01`, `P2028`) se traducen a
 *     `LOCK_TIMEOUT`, `DEADLOCK` y `TRANSACTION_TIMEOUT` **ocurran donde ocurran**: preparación,
 *     operación, commit o rollback;
 *   - cualquier otro error de `operation` se propaga **intacto** (`OfferConflictError`, validación,
 *     etc.): envolverlo ocultaría conflictos de dominio legítimos;
 *   - `INFRA_ERROR` queda reservado a fallos desconocidos de la maquinaria propia del helper
 *     (timeouts locales y adquisición de locks), nunca a errores de negocio arbitrarios.
 */
export async function withLockedRoots<T>(
  roots: readonly LockRoot[],
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  // Fail-closed: lanza antes de tocar la base de datos.
  const ordered = normalizeRoots(roots)
  const lockTimeoutMs = assertTimeout(
    options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS,
    'lockTimeoutMs'
  )
  const statementTimeoutMs = assertTimeout(
    options.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS,
    'statementTimeoutMs'
  )
  const client: LockCapableClient = options.client ?? db

  try {
    return await client.$transaction(
      async (tx) => {
        // Preparación: un fallo desconocido aquí sí es del helper → INFRA_ERROR.
        try {
          await applyLocalTimeouts(tx, lockTimeoutMs, statementTimeoutMs)
          for (const root of ordered) await lockRoot(tx, root)
        } catch (err) {
          throw toLockError(err)
        }
        return operation(tx)
      },
      { timeout: DEFAULT_TRANSACTION_TIMEOUT_MS, maxWait: DEFAULT_MAX_WAIT_MS }
    )
  } catch (err) {
    // Cubre también commit y rollback, que ocurren fuera del callback.
    throw translateConcurrencyError(err)
  }
}
