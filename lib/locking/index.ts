/**
 * Coordinación de locks de filas raíz (PR I1) — API pública.
 *
 * INERTE: ningún flujo de negocio importa este módulo todavía. Ver `with-locked-roots.ts`.
 */
export type { LockRoot, LockRootType, LockOptions, LockCapableClient } from './types'
export {
  ROOT_TYPE_RANK,
  ROOT_TABLES,
  ROOT_LABELS,
  isLockRootType,
  rootKey,
  normalizeRoots,
} from './roots'
export {
  LockError,
  LOCK_ERROR_MESSAGES,
  isLockError,
  extractPostgresCode,
  toLockError,
  type LockErrorCode,
} from './errors'
export {
  withLockedRoots,
  DEFAULT_LOCK_TIMEOUT_MS,
  DEFAULT_STATEMENT_TIMEOUT_MS,
  DEFAULT_TRANSACTION_TIMEOUT_MS,
  DEFAULT_MAX_WAIT_MS,
} from './with-locked-roots'
