/**
 * A3 — Errores de dominio de la valoración (tasación oficial). Conflictos de negocio esperados
 * (gate incumplido, estado terminal, rango inválido), NO errores técnicos. Mensajes visibles al
 * usuario: sin ids, estado interno, SQL, Prisma, stack ni PII. Mismo patrón que `EntryError`.
 */
export type ValuationErrorCode =
  | 'VEHICLE_NOT_FOUND'
  | 'SELLER_LEAD_NOT_FOUND'
  | 'VEHICLE_ROOT_CHANGED'
  | 'LEAD_ARCHIVED'
  | 'ENTRY_NOT_ACTIVE'
  | 'INSPECTION_NOT_COMPLETED'
  | 'VEHICLE_STATUS_NOT_ELIGIBLE'
  | 'INVALID_RANGE'
  | 'NEGATIVE_MONEY'
  | 'CONFIDENCE_REQUIRED'
  | 'REASON_REQUIRED'
  | 'VALUATION_STATUS_CONFLICT'

/** Mensajes visibles: sin ids, estado interno, SQL, Prisma, stack, cause ni PII. */
export const VALUATION_ERROR_MESSAGES: Record<ValuationErrorCode, string> = {
  VEHICLE_NOT_FOUND: 'Vehículo no encontrado',
  SELLER_LEAD_NOT_FOUND: 'No se ha encontrado el vendedor del vehículo',
  VEHICLE_ROOT_CHANGED:
    'Los datos del vehículo han cambiado mientras se procesaba. Inténtalo de nuevo.',
  LEAD_ARCHIVED: 'No se puede tasar oficialmente un lead archivado. Reactívalo primero.',
  ENTRY_NOT_ACTIVE:
    'La tasación oficial requiere una entrada oficial activa. Valida la entrada del vehículo primero.',
  INSPECTION_NOT_COMPLETED:
    'La tasación oficial requiere la inspección de entrada COMPLETADA en Taller.',
  VEHICLE_STATUS_NOT_ELIGIBLE: 'El vehículo no admite tasación oficial en su estado actual.',
  INVALID_RANGE: 'El rango es inválido: debe cumplirse mínimo ≤ recomendado ≤ máximo.',
  NEGATIVE_MONEY: 'Los importes no pueden ser negativos.',
  CONFIDENCE_REQUIRED: 'Selecciona la confianza de la tasación (Alta, Media o Baja).',
  REASON_REQUIRED: 'Indica el motivo de la tasación manual.',
  VALUATION_STATUS_CONFLICT:
    'El estado del vehículo cambió mientras se registraba la tasación. Inténtalo de nuevo.',
}

/** Conflicto de negocio esperado en el flujo de tasación oficial. No es un error técnico. */
export class ValuationError extends Error {
  readonly code: ValuationErrorCode
  constructor(code: ValuationErrorCode) {
    super(VALUATION_ERROR_MESSAGES[code])
    this.name = 'ValuationError'
    this.code = code
  }
}

export function isValuationError(err: unknown): err is ValuationError {
  return err instanceof ValuationError
}
