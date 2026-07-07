/**
 * Calendario operativo (F1) — modelo de lectura unificado.
 *
 * El calendario NO es una tabla nueva que duplique Entregas/Taller: es una vista
 * que AGREGA lo ya agendado en el CRM en una forma común `CalendarItem`.
 * Cada ítem enlaza a su ficha real (la entrega sigue viviendo en Entregas, etc.).
 * En F2 se añade un 5º origen: los `CalendarEvent` propios (citas, limpiezas…).
 */

export type CalendarSource = 'delivery' | 'workorder' | 'followup' | 'next_action' | 'event'

export type CalendarTone = 'default' | 'success' | 'warn' | 'danger' | 'muted'

export type CalendarItem = {
  /** id único con prefijo de origen, p.ej. "delivery:abc123" */
  id: string
  source: CalendarSource
  /** Etiqueta legible del tipo (Entrega, Taller, Cita…) */
  kindLabel: string
  title: string
  start: Date
  end: Date | null
  /** true = sin hora significativa (solo fecha) */
  allDay: boolean
  status: string
  tone: CalendarTone
  /** ruta a la ficha/entidad de origen */
  href: string
  assigneeName: string | null
  /** contexto secundario: cliente o vehículo asociado */
  contextLabel: string | null
}

export type CalendarFilters = {
  /** filtra por orígenes; vacío = todos */
  sources?: CalendarSource[]
  /** filtra por responsable (id de usuario); null = sin filtro */
  assigneeId?: string | null
}
