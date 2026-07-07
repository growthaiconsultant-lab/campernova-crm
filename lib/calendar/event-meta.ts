import type { CalendarEventType, CalendarEventStatus, CalendarEventPriority } from '@prisma/client'

/** Labels y opciones de los eventos propios del calendario (F2). */

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  CITA: 'Cita',
  LIMPIEZA: 'Limpieza',
  SEGUIMIENTO: 'Seguimiento',
  OTRO: 'Otro',
}

export const EVENT_STATUS_LABELS: Record<CalendarEventStatus, string> = {
  PROGRAMADO: 'Programado',
  CONFIRMADO: 'Confirmado',
  EN_CURSO: 'En curso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
  NO_SHOW: 'No se presentó',
}

export const EVENT_PRIORITY_LABELS: Record<CalendarEventPriority, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
}

export const EVENT_TYPE_OPTIONS = (
  Object.entries(EVENT_TYPE_LABELS) as [CalendarEventType, string][]
).map(([value, label]) => ({ value, label }))

export const EVENT_PRIORITY_OPTIONS = (
  Object.entries(EVENT_PRIORITY_LABELS) as [CalendarEventPriority, string][]
).map(([value, label]) => ({ value, label }))

export function isValidEventType(v: string): v is CalendarEventType {
  return v in EVENT_TYPE_LABELS
}
export function isValidEventPriority(v: string): v is CalendarEventPriority {
  return v in EVENT_PRIORITY_LABELS
}

/**
 * Transiciones de estado válidas. Terminales: COMPLETADO, CANCELADO, NO_SHOW.
 */
export const EVENT_STATUS_TRANSITIONS: Record<CalendarEventStatus, CalendarEventStatus[]> = {
  PROGRAMADO: ['CONFIRMADO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO', 'NO_SHOW'],
  CONFIRMADO: ['EN_CURSO', 'COMPLETADO', 'CANCELADO', 'NO_SHOW'],
  EN_CURSO: ['COMPLETADO', 'CANCELADO'],
  COMPLETADO: [],
  CANCELADO: [],
  NO_SHOW: [],
}

export function isValidEventTransition(
  from: CalendarEventStatus,
  to: CalendarEventStatus
): boolean {
  return EVENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export function isTerminalEventStatus(s: CalendarEventStatus): boolean {
  return EVENT_STATUS_TRANSITIONS[s].length === 0
}
