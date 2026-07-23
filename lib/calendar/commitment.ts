/**
 * Naturaleza del compromiso de un evento de calendario (PR I0).
 *
 * El tipo de evento no basta para saber si romperlo afecta a un cliente: una `LLAMADA` puede ser
 * una llamada concertada con el comprador o un recordatorio para llamarle. Este módulo define la
 * clasificación explícita y las reglas que la derivan o la exigen.
 *
 * Reglas por tipo:
 *   · `CITA`        → siempre EXTERNO (una cita se acuerda con alguien).
 *   · `LIMPIEZA`    → siempre INTERNO (operación de nave).
 *   · `LLAMADA`     → elección obligatoria del usuario.
 *   · `OTRO`        → elección obligatoria del usuario.
 *   · `SEGUIMIENTO` → INDETERMINADO: no es creable desde la UI (fuera de `NATIVE_EVENT_TYPES`) y
 *     no se reactiva aquí; si apareciera, se clasifica a mano.
 *
 * NOTA: este módulo NO decide bloqueos de archivado. Esa regla llega en I4/B2 final.
 */
import type { CalendarEventType, EventCommitment } from '@prisma/client'

export const COMMITMENT_LABELS: Record<EventCommitment, string> = {
  EXTERNO: 'Compromiso externo',
  INTERNO: 'Tarea interna',
  INDETERMINADO: 'Pendiente de clasificar',
}

/** Descripción de apoyo para el formulario; explica la consecuencia, no el enum. */
export const COMMITMENT_HINTS: Record<EventCommitment, string> = {
  EXTERNO: 'Acordado con un cliente o tercero',
  INTERNO: 'Recordatorio u operación propia',
  INDETERMINADO: 'Sin clasificar todavía',
}

/** Clasificación que el tipo determina por sí solo; el usuario no la elige. */
export const FORCED_COMMITMENT_BY_TYPE: Partial<Record<CalendarEventType, EventCommitment>> = {
  CITA: 'EXTERNO',
  LIMPIEZA: 'INTERNO',
}

/** Tipos en los que el usuario DEBE elegir; su semántica no es deducible. */
export const EXPLICIT_COMMITMENT_TYPES: CalendarEventType[] = ['LLAMADA', 'OTRO']

/** Opciones ofrecidas al usuario. `INDETERMINADO` nunca se elige a mano. */
export const COMMITMENT_CHOICES: EventCommitment[] = ['EXTERNO', 'INTERNO']

export function requiresExplicitCommitment(type: CalendarEventType): boolean {
  return EXPLICIT_COMMITMENT_TYPES.includes(type)
}

export function isCommitmentChoice(value: unknown): value is EventCommitment {
  return typeof value === 'string' && (COMMITMENT_CHOICES as string[]).includes(value)
}

export type CommitmentResolution =
  | { ok: true; value: EventCommitment }
  | { ok: false; reason: 'required' | 'incompatible' }

/**
 * Decide la clasificación definitiva de un evento a partir de su tipo y de lo que envíe el
 * cliente. Es la ÚNICA fuente de verdad: el servidor la aplica siempre, así que un valor
 * manipulado en el navegador no puede colar una combinación inválida.
 *
 *  - Tipo con clasificación forzada: se impone la del tipo; si llega otra distinta → `incompatible`.
 *  - Tipo que exige elección: sin valor → `required`; con valor no elegible → `incompatible`.
 *  - Resto (`SEGUIMIENTO`): INDETERMINADO.
 *
 * Sirve tanto para crear como para cambiar el tipo de un evento existente: al cambiar de tipo se
 * vuelve a resolver, de modo que nunca se conserva una clasificación incompatible con el tipo.
 */
export function resolveCommitment(
  type: CalendarEventType,
  provided?: EventCommitment | null
): CommitmentResolution {
  const forced = FORCED_COMMITMENT_BY_TYPE[type]
  if (forced) {
    if (provided != null && provided !== forced) return { ok: false, reason: 'incompatible' }
    return { ok: true, value: forced }
  }

  if (requiresExplicitCommitment(type)) {
    if (provided == null) return { ok: false, reason: 'required' }
    if (!isCommitmentChoice(provided)) return { ok: false, reason: 'incompatible' }
    return { ok: true, value: provided }
  }

  // `SEGUIMIENTO`: sin UI de creación y sin semántica deducible.
  if (provided != null && !isCommitmentChoice(provided))
    return { ok: false, reason: 'incompatible' }
  return { ok: true, value: provided ?? 'INDETERMINADO' }
}

/** Comprueba una pareja (tipo, clasificación) ya persistida o entrante. */
export function isCommitmentValidForType(
  type: CalendarEventType,
  commitment: EventCommitment
): boolean {
  const forced = FORCED_COMMITMENT_BY_TYPE[type]
  if (forced) return commitment === forced
  if (requiresExplicitCommitment(type)) return isCommitmentChoice(commitment)
  return true
}

/**
 * Reclasificar un evento ya clasificado. No se permite volver a `INDETERMINADO`: es un estado de
 * origen del histórico, no un destino — perderlo sería reintroducir la ambigüedad a mano.
 */
export function canReclassify(
  type: CalendarEventType,
  next: EventCommitment
): CommitmentResolution {
  if (!isCommitmentChoice(next)) return { ok: false, reason: 'incompatible' }
  if (!isCommitmentValidForType(type, next)) return { ok: false, reason: 'incompatible' }
  return { ok: true, value: next }
}
