/**
 * Errores de dominio de la entrada oficial (PR-A2).
 *
 * Conflictos de negocio esperados (precondición incumplida, carrera, estado terminal). NO son
 * errores técnicos. Los mensajes son visibles al usuario: sin ids, estado interno, SQL, Prisma,
 * stack ni PII. Mismo patrón que `DeliveryCreationError`.
 */
export type EntryErrorCode =
  | 'VEHICLE_NOT_FOUND'
  | 'SELLER_LEAD_NOT_FOUND'
  | 'LEAD_ARCHIVED'
  | 'VEHICLE_ROOT_CHANGED'
  | 'ENTRY_ALREADY_VALIDATED'
  | 'ENTRY_ANNULLED_TERMINAL'
  | 'ENTRY_NOT_ACTIVE'
  | 'CONTRATO_GESTION_MISSING'
  | 'VEHICLE_NOT_PRESENT'
  | 'EXPEDIENTE_INCOMPLETE'
  | 'RESPONSIBLE_NOT_SET'
  | 'PARKING_LOCATION_MISSING'
  | 'KEYS_NOT_RECEIVED'
  | 'CHECKLIST_NOT_CLASSIFIED'
  | 'INSPECTION_ALREADY_ACTIVE'
  | 'ANNULMENT_NOTES_REQUIRED'

/** Mensajes visibles: sin ids, estado interno, SQL, Prisma, stack, cause ni PII. */
export const ENTRY_ERROR_MESSAGES: Record<EntryErrorCode, string> = {
  VEHICLE_NOT_FOUND: 'Vehículo no encontrado',
  SELLER_LEAD_NOT_FOUND: 'No se ha encontrado el vendedor del vehículo',
  LEAD_ARCHIVED: 'No se puede validar la entrada de un lead archivado. Reactívalo primero.',
  VEHICLE_ROOT_CHANGED:
    'Los datos del vehículo han cambiado mientras se procesaba. Inténtalo de nuevo.',
  ENTRY_ALREADY_VALIDATED: 'La entrada oficial de este vehículo ya está validada.',
  ENTRY_ANNULLED_TERMINAL: 'La entrada de este vehículo fue anulada y no puede revalidarse.',
  ENTRY_NOT_ACTIVE: 'No hay una entrada oficial activa para anular.',
  CONTRATO_GESTION_MISSING:
    'Falta el contrato de gestión vigente. Súbelo antes de validar la entrada.',
  VEHICLE_NOT_PRESENT: 'Registra primero la llegada física del vehículo a la nave.',
  EXPEDIENTE_INCOMPLETE: 'El expediente mínimo del vehículo está incompleto.',
  RESPONSIBLE_NOT_SET: 'Asigna un comercial responsable antes de validar la entrada.',
  PARKING_LOCATION_MISSING: 'Indica la ubicación de aparcamiento en la nave.',
  KEYS_NOT_RECEIVED: 'Registra las llaves recibidas (cantidad y ubicación).',
  CHECKLIST_NOT_CLASSIFIED:
    'Clasifica todos los documentos requeridos (recibido, no disponible o no aplicable).',
  INSPECTION_ALREADY_ACTIVE: 'El vehículo ya tiene una orden de inspección de entrada activa.',
  ANNULMENT_NOTES_REQUIRED: 'Las notas son obligatorias cuando el motivo es "Otro".',
}

/** Conflicto de negocio esperado en el flujo de entrada oficial. No es un error técnico. */
export class EntryError extends Error {
  readonly code: EntryErrorCode
  constructor(code: EntryErrorCode) {
    super(ENTRY_ERROR_MESSAGES[code])
    this.name = 'EntryError'
    this.code = code
  }
}

export function isEntryError(err: unknown): err is EntryError {
  return err instanceof EntryError
}
