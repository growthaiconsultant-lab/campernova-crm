/**
 * Tipos de la coordinación de locks de filas raíz (PR I1).
 *
 * Las "raíces" son las tres filas de las que cuelga toda la operativa comercial. Bloquearlas en
 * un orden global fijo es lo que permitirá, en PRs posteriores, que dos flujos concurrentes no
 * puedan crear un compromiso y archivarlo a la vez.
 */
import type { Prisma } from '@prisma/client'

/** Entidades que pueden actuar como raíz de coordinación. Conjunto CERRADO. */
export type LockRootType = 'vehicle' | 'sellerLead' | 'buyerLead'

/** Una fila concreta a bloquear. */
export type LockRoot =
  | { type: 'vehicle'; id: string }
  | { type: 'sellerLead'; id: string }
  | { type: 'buyerLead'; id: string }

export type LockOptions = {
  /**
   * Espera máxima por un lock ocupado antes de rendirse (`SET LOCAL lock_timeout`).
   * Agotarlo produce `LOCK_TIMEOUT`, no una espera indefinida.
   */
  lockTimeoutMs?: number
  /** Duración máxima de cada sentencia dentro de la transacción (`SET LOCAL statement_timeout`). */
  statementTimeoutMs?: number
  /**
   * Cliente Prisma a usar. Por defecto el singleton de la app; se inyecta en los tests para
   * apuntar a la base efímera o a un doble.
   */
  client?: LockCapableClient
}

/**
 * Mínimo que necesita el helper de un cliente Prisma: abrir una transacción interactiva.
 * Tipar solo esto permite inyectar dobles en los tests sin arrastrar todo `PrismaClient`.
 */
export type LockCapableClient = {
  $transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { timeout?: number; maxWait?: number }
  ): Promise<T>
}
