import type { CalendarEventType, CalendarEventStatus, CalendarEventPriority } from '@prisma/client'

/** Labels y opciones de los eventos propios del calendario (F2). */

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  CITA: 'Cita',
  LLAMADA: 'Llamada',
  LIMPIEZA: 'Limpieza',
  SEGUIMIENTO: 'Seguimiento',
  OTRO: 'Otro',
}

/**
 * Tipos que se crean como evento del calendario (F3). Los otros de la hoja del
 * dueño (Entrega, Entrada, Reparación, Mejora) se crean en su módulo y el
 * calendario los agrega — el selector del calendario redirige allí.
 */
export const NATIVE_EVENT_TYPES: CalendarEventType[] = ['CITA', 'LLAMADA', 'LIMPIEZA', 'OTRO']

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

export const EVENT_TYPE_OPTIONS = NATIVE_EVENT_TYPES.map((value) => ({
  value,
  label: EVENT_TYPE_LABELS[value],
}))

export const EVENT_PRIORITY_OPTIONS = (
  Object.entries(EVENT_PRIORITY_LABELS) as [CalendarEventPriority, string][]
).map(([value, label]) => ({ value, label }))

export function isValidEventType(v: string): v is CalendarEventType {
  return v in EVENT_TYPE_LABELS
}
export function isValidEventPriority(v: string): v is CalendarEventPriority {
  return v in EVENT_PRIORITY_LABELS
}

const EVENT_STATUSES: CalendarEventStatus[] = [
  'PROGRAMADO',
  'CONFIRMADO',
  'EN_CURSO',
  'COMPLETADO',
  'CANCELADO',
  'NO_SHOW',
]

/**
 * El estado del evento se puede corregir libremente. Que un estado sea terminal para consultas de
 * trabajo pendiente no impide volver a clasificar el evento.
 */
export const EVENT_STATUS_TRANSITIONS: Record<CalendarEventStatus, CalendarEventStatus[]> = {
  PROGRAMADO: EVENT_STATUSES.filter((status) => status !== 'PROGRAMADO'),
  CONFIRMADO: EVENT_STATUSES.filter((status) => status !== 'CONFIRMADO'),
  EN_CURSO: EVENT_STATUSES.filter((status) => status !== 'EN_CURSO'),
  COMPLETADO: EVENT_STATUSES.filter((status) => status !== 'COMPLETADO'),
  CANCELADO: EVENT_STATUSES.filter((status) => status !== 'CANCELADO'),
  NO_SHOW: EVENT_STATUSES.filter((status) => status !== 'NO_SHOW'),
}

export function isValidEventTransition(
  from: CalendarEventStatus,
  to: CalendarEventStatus
): boolean {
  return EVENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export function isTerminalEventStatus(s: CalendarEventStatus): boolean {
  return (['COMPLETADO', 'CANCELADO', 'NO_SHOW'] as CalendarEventStatus[]).includes(s)
}
