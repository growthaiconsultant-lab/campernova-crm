/**
 * Planificación de capacidad del taller (lógica pura, sin Prisma → testable).
 *
 * Modelo v1 (cola por mecánico): cada mecánico trabaja `hoursPerDay` en los días laborables.
 * Una orden nueva entra en cola detrás del trabajo ya planificado (backlog) y ocupa
 * `ceil(horas / hoursPerDay)` días laborables. Con eso damos una **fecha de entrega realista**
 * sin sobre-comprometer.
 *
 * Todas las funciones reciben las fechas como parámetro (no usan `new Date()` dentro) para que
 * los tests sean deterministas.
 */

/** Días laborables por defecto: lunes(1) a viernes(5). Domingo=0, Sábado=6. */
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5] as const

/** Capacidad por mecánico y día (horas) por defecto. Configurable por taller. */
export const DEFAULT_HOURS_PER_DAY = 8

export type Schedule = { start: Date; end: Date }

export type SuggestScheduleInput = {
  /** Horas previstas de la orden a planificar. */
  plannedHours: number
  /** Capacidad diaria del mecánico (horas). */
  hoursPerDay?: number
  /** Suma de horas previstas ya en cola para ese mecánico (órdenes sin completar por delante). */
  backlogHours?: number
  /** Desde cuándo se puede empezar (p.ej. hoy). */
  from: Date
  /** Días laborables (0=domingo … 6=sábado). */
  workingDays?: readonly number[]
}

export type SuggestScheduleResult = {
  /** Primer día laborable en el que arranca la orden. */
  start: Date
  /** Último día laborable de trabajo (fecha estimada de finalización). */
  end: Date
  /** Días laborables de trabajo que ocupa la orden. */
  workingDaysNeeded: number
}

/** ¿Es `date` un día laborable? */
export function isWorkingDay(
  date: Date,
  workingDays: readonly number[] = DEFAULT_WORKING_DAYS
): boolean {
  return workingDays.includes(date.getDay())
}

/** Devuelve el mismo día si es laborable, o el siguiente día laborable. */
export function nextWorkingDay(
  from: Date,
  workingDays: readonly number[] = DEFAULT_WORKING_DAYS
): Date {
  const d = startOfDay(from)
  let guard = 0
  while (!isWorkingDay(d, workingDays)) {
    d.setDate(d.getDate() + 1)
    if (++guard > 31) break // salvaguarda anti-bucle (si workingDays estuviera vacío)
  }
  return d
}

/**
 * Avanza `n` días LABORABLES desde `from` (n=0 → primer día laborable en/después de `from`).
 */
export function addWorkingDays(
  from: Date,
  n: number,
  workingDays: readonly number[] = DEFAULT_WORKING_DAYS
): Date {
  let d = nextWorkingDay(from, workingDays)
  let remaining = Math.max(0, Math.floor(n))
  let guard = 0
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    d = nextWorkingDay(d, workingDays)
    remaining--
    if (++guard > 3650) break
  }
  return d
}

/** Días laborables necesarios para `hours` a `hoursPerDay` (mínimo 1 si hay horas). */
export function workingDaysForHours(
  hours: number,
  hoursPerDay: number = DEFAULT_HOURS_PER_DAY
): number {
  if (hours <= 0) return 0
  if (hoursPerDay <= 0) return 1
  return Math.max(1, Math.ceil(hours / hoursPerDay))
}

/**
 * Sugiere la ventana de trabajo (start/end) para una orden, teniendo en cuenta el backlog
 * del mecánico. Da la base para una **fecha de entrega realista**.
 */
export function suggestSchedule(input: SuggestScheduleInput): SuggestScheduleResult {
  const hoursPerDay =
    input.hoursPerDay && input.hoursPerDay > 0 ? input.hoursPerDay : DEFAULT_HOURS_PER_DAY
  const workingDays = input.workingDays ?? DEFAULT_WORKING_DAYS
  const plannedHours = Math.max(0, input.plannedHours)
  const backlogHours = Math.max(0, input.backlogHours ?? 0)

  // El trabajo nuevo empieza tras vaciar el backlog (en días laborables completos).
  const backlogDays = Math.ceil(backlogHours / hoursPerDay)
  const start = addWorkingDays(input.from, backlogDays, workingDays)

  const workingDaysNeeded = workingDaysForHours(plannedHours, hoursPerDay)
  // `end` = último día de trabajo: si ocupa 1 día, end=start; si 2, el siguiente laborable, etc.
  const end = addWorkingDays(start, Math.max(0, workingDaysNeeded - 1), workingDays)

  return { start, end, workingDaysNeeded }
}

export type HoursDeviation = {
  planned: number | null
  real: number
  /** real − planned (positivo = más horas de las previstas). null si no hay previsión. */
  deviation: number | null
  /** Desviación en % sobre lo previsto. null si no hay previsión (o previsión 0). */
  deviationPct: number | null
  status: 'sin_prevision' | 'dentro' | 'desviado_arriba' | 'por_debajo'
}

/**
 * Compara horas previstas vs reales (la visibilidad del caso "facturé 8h pero fueron 25h").
 * `tolerancePct`: margen aceptable antes de marcar `desviado_arriba` (por defecto 15%).
 */
export function computeHoursDeviation(
  plannedHours: number | null | undefined,
  realHours: number,
  tolerancePct = 15
): HoursDeviation {
  const real = Math.max(0, realHours)
  const planned = plannedHours != null && plannedHours > 0 ? plannedHours : null

  if (planned == null) {
    return { planned: null, real, deviation: null, deviationPct: null, status: 'sin_prevision' }
  }

  const deviation = real - planned
  const deviationPct = (deviation / planned) * 100

  let status: HoursDeviation['status'] = 'dentro'
  if (deviationPct > tolerancePct) status = 'desviado_arriba'
  else if (deviationPct < -tolerancePct) status = 'por_debajo'

  return { planned, real, deviation, deviationPct, status }
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date.getTime())
  d.setHours(0, 0, 0, 0)
  return d
}
