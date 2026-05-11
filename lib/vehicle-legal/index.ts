export type { VehicleLegalInput, DocumentSummary, MissingRequirement, TargetStatus } from './types'
export { ITV_WARNING_DAYS } from './types'
export {
  PUBLICADO_REQUIRED_DOCS,
  PUBLICADO_MIN_PHOTOS,
  TASADO_MIN_PHOTOS,
  DOC_LABELS,
} from './requirements'
export { listMissingRequirements, isReadyForStatus, calculateCompletionPercent } from './validate'
export { getVehicleLegalInput, getVehicleDocumentSummary } from './prisma-deps'
