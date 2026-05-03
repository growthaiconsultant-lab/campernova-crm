/// Cálculo de tiempo medio (mediana) por estado a partir del activity log.
///
/// El content de las activities CAMBIO_ESTADO sigue formatos estables (controlados
/// en lib/state-machine.ts y los server actions):
///   - "Estado cambiado: <Label1> → <Label2>"           (SellerLead/BuyerLead)
///   - "Vehículo: <Label1> → <Label2>"                  (Vehicle bajo SellerLead)
///
/// Estrategia: extraer la parte tras "→" como label de DESTINO. Para el estado
/// de ORIGEN usamos el `entity.createdAt` (estado inicial es siempre NUEVO) o
/// el destino de la activity anterior, lo que da una secuencia ordenada por tiempo.

export type StateChangeActivity = {
  createdAt: Date
  content: string | null
}

export type EntityActivities<T extends string> = {
  initialStatus: T
  createdAt: Date
  /// Activities CAMBIO_ESTADO ordenadas por createdAt ASC
  activities: StateChangeActivity[]
}

/// Parsea el label de destino del content. Devuelve null si no machea.
/// Acepta formatos: "X → Y" o "Algo: X → Y".
export function parseDestinationLabel(content: string | null): string | null {
  if (!content) return null
  const match = content.match(/→\s*(.+?)\s*$/)
  return match ? match[1].trim() : null
}

/// Mapa label→status para reverse lookup.
export function labelsToStatuses<T extends string>(labels: Record<T, string>): Map<string, T> {
  const map = new Map<string, T>()
  for (const key of Object.keys(labels) as T[]) {
    map.set(labels[key], key)
  }
  return map
}

/// Para una sola entidad, devuelve la duración (ms) que pasó en cada estado del
/// que ya transicionó. Estados terminales (en los que la entidad sigue) NO se
/// incluyen — solo medimos tiempo en estados completados.
export function durationsByStateForEntity<T extends string>(
  entity: EntityActivities<T>,
  labelToStatus: Map<string, T>
): Map<T, number[]> {
  const result = new Map<T, number[]>()

  let prevStatus: T = entity.initialStatus
  let prevAt: Date = entity.createdAt

  for (const act of entity.activities) {
    const destLabel = parseDestinationLabel(act.content)
    if (!destLabel) continue
    const destStatus = labelToStatus.get(destLabel)
    if (!destStatus) continue

    const durationMs = act.createdAt.getTime() - prevAt.getTime()
    if (durationMs >= 0) {
      const arr = result.get(prevStatus) ?? []
      arr.push(durationMs)
      result.set(prevStatus, arr)
    }

    prevStatus = destStatus
    prevAt = act.createdAt
  }

  return result
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export type StateMedianRow<T extends string> = {
  status: T
  medianMs: number
  sampleSize: number
}

/// Agrega múltiples entidades en una tabla con mediana por estado.
export function aggregateMediansByState<T extends string>(
  entities: EntityActivities<T>[],
  labels: Record<T, string>
): StateMedianRow<T>[] {
  const labelToStatus = labelsToStatuses(labels)
  const collected = new Map<T, number[]>()

  for (const entity of entities) {
    const perEntity = durationsByStateForEntity(entity, labelToStatus)
    perEntity.forEach((durations, status) => {
      const acc = collected.get(status) ?? []
      acc.push(...durations)
      collected.set(status, acc)
    })
  }

  const rows: StateMedianRow<T>[] = []
  collected.forEach((durations, status) => {
    const m = median(durations)
    if (m !== null) {
      rows.push({ status, medianMs: m, sampleSize: durations.length })
    }
  })
  return rows
}

/// Formatea ms a "Xh Ym" o "Xd Yh" según escala. >24h → días+horas; ≤24h → horas+min.
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24)
    const hours = totalHours % 24
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }
  if (totalHours >= 1) {
    const mins = totalMinutes % 60
    return mins > 0 ? `${totalHours}h ${mins}m` : `${totalHours}h`
  }
  return `${totalMinutes}m`
}
