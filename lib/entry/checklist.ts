/**
 * Derivación (read model) del checklist documental de la entrada oficial (PR-A2, §4).
 *
 * FUENTE DE VERDAD de "recibido" = existencia de una versión documental VIGENTE (ACTIVE) del
 * documento raíz. La tabla `VehicleDocumentRequirementDisposition` NO la duplica: solo registra qué
 * pasa cuando el documento falta. Derivación por categoría:
 *   documento con versión ACTIVE            → RECIBIDO
 *   sin documento + disposición registrada  → valor de la disposición (PENDIENTE/NO_DISPONIBLE/NO_APLICABLE)
 *   sin documento + sin registro            → SIN_CLASIFICAR (derivado, nunca persistido)
 *
 * `RECIBIDO` y `SIN_CLASIFICAR` son DERIVADOS: nunca se persisten. Función pura, sin Prisma; el
 * adapter (prisma-deps) construye `EntryChecklistInput` con una query read-only.
 *
 * ⚠️ `CONTRATO_GESTION` NUNCA se satisface con una disposición: NO_DISPONIBLE/NO_APLICABLE NO cuentan
 * como cumplido. Requiere un documento vigente real. Esa regla la aplica `validate.ts`
 * (`isContratoGestionSatisfied`); aquí la derivación es uniforme por categoría.
 */
import type { DocumentRequirementDisposition, VehicleDocumentCategory } from '@prisma/client'

/** Estado derivado de una categoría documental en el checklist de entrada. */
export type DocumentChecklistState =
  | 'RECIBIDO'
  | 'PENDIENTE'
  | 'NO_DISPONIBLE'
  | 'NO_APLICABLE'
  | 'SIN_CLASIFICAR'

/** Señales por categoría, leídas de la BD (adapter). */
export type CategoryDocSignal = {
  category: VehicleDocumentCategory
  /** true si existe un documento de la categoría con al menos una versión ACTIVE (vigente). */
  hasActiveVersion: boolean
  /** Disposición explícita registrada para la categoría, si la hay (documento ausente). */
  disposition: DocumentRequirementDisposition | null
}

export type EntryChecklistInput = {
  /** Señales de las categorías relevantes para la entrada. */
  signals: CategoryDocSignal[]
}

/** Una fila derivada del checklist documental. */
export type DocumentChecklistRow = {
  category: VehicleDocumentCategory
  state: DocumentChecklistState
}

/**
 * Deriva el estado de una única categoría a partir de sus señales.
 * Documento vigente manda sobre cualquier disposición.
 */
export function deriveCategoryState(signal: CategoryDocSignal): DocumentChecklistState {
  if (signal.hasActiveVersion) return 'RECIBIDO'
  if (signal.disposition != null) return signal.disposition
  return 'SIN_CLASIFICAR'
}

/** Deriva el checklist documental completo (una fila por categoría de las señales recibidas). */
export function deriveDocumentChecklist(input: EntryChecklistInput): DocumentChecklistRow[] {
  return input.signals.map((signal) => ({
    category: signal.category,
    state: deriveCategoryState(signal),
  }))
}

/**
 * `CONTRATO_GESTION` está satisfecho SOLO con un documento vigente real. Una disposición
 * (NO_DISPONIBLE/NO_APLICABLE) NO cuenta.
 */
export function isContratoGestionSatisfied(signals: CategoryDocSignal[]): boolean {
  const contrato = signals.find((s) => s.category === 'CONTRATO_GESTION')
  return contrato?.hasActiveVersion === true
}

/**
 * ¿Están CLASIFICADAS todas las categorías dadas? Una categoría está clasificada si NO deriva en
 * `SIN_CLASIFICAR` (es decir: tiene documento vigente o una disposición explícita).
 */
export function areCategoriesClassified(
  signals: CategoryDocSignal[],
  required: readonly VehicleDocumentCategory[]
): boolean {
  return required.every((category) => {
    const signal = signals.find((s) => s.category === category)
    if (!signal) return false
    return deriveCategoryState(signal) !== 'SIN_CLASIFICAR'
  })
}
