import type { CalendarItem } from './types'

/**
 * F6: agrupa los ítems del calendario por responsable (assigneeId).
 * Los ítems sin responsable se descartan del digest (no hay a quién avisar).
 * Función pura → testable sin base de datos.
 */
export function groupItemsByAssignee(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const byUser = new Map<string, CalendarItem[]>()
  for (const it of items) {
    if (!it.assigneeId) continue
    const list = byUser.get(it.assigneeId) ?? []
    list.push(it)
    byUser.set(it.assigneeId, list)
  }
  // Orden interno por hora de inicio
  Array.from(byUser.values()).forEach((list) => {
    list.sort((a, b) => a.start.getTime() - b.start.getTime())
  })
  return byUser
}
