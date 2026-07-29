/**
 * Entrada oficial del vehículo (PR-A2) — API pública.
 *
 * Núcleo puro/transaccional (deps-injectable) para validar y anular la entrada oficial, más la
 * derivación del checklist documental. Los server actions cablean prisma + revalidate/KPIs FUERA de
 * la transacción abierta por `withLockedRoots`.
 */
export { EntryError, ENTRY_ERROR_MESSAGES, isEntryError, type EntryErrorCode } from './errors'
export { ENTRY_REQUIRE_PRECONDITIONS } from './config'
export {
  deriveCategoryState,
  deriveDocumentChecklist,
  isContratoGestionSatisfied,
  areCategoriesClassified,
  type DocumentChecklistState,
  type DocumentChecklistRow,
  type CategoryDocSignal,
  type EntryChecklistInput,
} from './checklist'
export {
  getEntryChecklistSignals,
  getEntryExpedienteInput,
  type EntryReadClient,
} from './prisma-deps'
export {
  isReadyForOfficialEntry,
  evaluateOfficialEntryExpediente,
  type OfficialEntryExpedienteInput,
  type OfficialEntryExpedienteResult,
} from './entry-expediente'
export {
  validateEntryTx,
  buildEntryRoots,
  isPotentialActiveInspectionConflict,
  ACTIVE_WORKORDER_STATUSES,
  ACTIVE_INSPECTION_UNIQUE_INDEX,
  ENTRY_CLASSIFIED_DOC_CATEGORIES,
  ENTRY_SIGNAL_CATEGORIES,
  INSPECTION_CHECKLIST,
  type ValidateEntryParams,
  type ValidateEntryHooks,
} from './validate'
export { annulEntryTx, type AnnulEntryParams, type AnnulEntryHooks } from './annul'
export {
  registerPhysicalArrivalTx,
  type RegisterArrivalParams,
  type RegisterArrivalHooks,
} from './arrival'
