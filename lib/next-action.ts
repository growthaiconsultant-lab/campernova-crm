import type { NextActionType } from '@prisma/client'

/**
 * Próxima acción comercial (CAM-60).
 * Módulo puro: labels, opciones, default al crear lead y cálculo de vencimiento.
 */

export const NEXT_ACTION_LABELS: Record<NextActionType, string> = {
  LLAMAR: 'Llamar',
  WHATSAPP: 'Enviar WhatsApp',
  EMAIL: 'Enviar email',
  ENVIAR_VEHICULOS: 'Enviar vehículos',
  PEDIR_DOCS: 'Pedir documentación',
  AGENDAR_VISITA: 'Agendar visita',
  SEGUIMIENTO: 'Hacer seguimiento',
  CERRAR: 'Cerrar operación',
}

export const NEXT_ACTION_OPTIONS = (
  Object.entries(NEXT_ACTION_LABELS) as [NextActionType, string][]
).map(([value, label]) => ({ value, label }))

export function isValidNextActionType(value: string): value is NextActionType {
  return value in NEXT_ACTION_LABELS
}

/**
 * Default al crear un lead: llamar mañana a las 10:00 (hora local del servidor).
 */
export function defaultNextActionForNewLead(now: Date = new Date()): {
  type: NextActionType
  dueAt: Date
} {
  const dueAt = new Date(now)
  dueAt.setDate(dueAt.getDate() + 1)
  dueAt.setHours(10, 0, 0, 0)
  return { type: 'LLAMAR', dueAt }
}

/** Mismo default con la forma de los campos Prisma, para spreads en `create()`. */
export function defaultNextActionData(now: Date = new Date()): {
  nextActionType: NextActionType
  nextActionDueAt: Date
} {
  const { type, dueAt } = defaultNextActionForNewLead(now)
  return { nextActionType: type, nextActionDueAt: dueAt }
}

export function isNextActionOverdue(
  dueAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!dueAt) return false
  return dueAt.getTime() < now.getTime()
}

/** Formatea la fecha de la próxima acción de forma compacta ("mañana 10:00", "12 jul 10:00"). */
export function formatNextActionDue(dueAt: Date, now: Date = new Date()): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(dueAt) - startOfDay(now)) / 86400000)
  const time = dueAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  if (dayDiff === 0) return `hoy ${time}`
  if (dayDiff === 1) return `mañana ${time}`
  if (dayDiff === -1) return `ayer ${time}`
  const date = dueAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return `${date} ${time}`
}
