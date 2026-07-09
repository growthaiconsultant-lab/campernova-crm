/**
 * Bloque F1 KPIs — objetivos y umbrales de semáforo (definidos por el dueño).
 * Fuente única: cambiar aquí ajusta todas las KPI cards y alertas.
 */

export type Semaphore = 'green' | 'amber' | 'red' | 'gray'

/** Objetivos de negocio. */
export const KPI_TARGETS = {
  monthlySales: 7, // ventas cerradas/mes
  minMarginPct: 4, // margen mínimo por operación (%)
  trustPassportPct: 70, // % de stock con sello objetivo
  dataCompletenessPct: 80, // % completitud objetivo
} as const

/** Devuelve el color por umbrales "mayor es mejor" (green ≥ greenAt, amber ≥ amberAt). */
export function semHigherBetter(value: number, greenAt: number, amberAt: number): Semaphore {
  if (value >= greenAt) return 'green'
  if (value >= amberAt) return 'amber'
  return 'red'
}

/** Devuelve el color por umbrales "menor es mejor" (green < greenBelow, amber < amberBelow). */
export function semLowerBetter(value: number, greenBelow: number, amberBelow: number): Semaphore {
  if (value < greenBelow) return 'green'
  if (value < amberBelow) return 'amber'
  return 'red'
}

// ── Semáforos concretos ──
export const sem = {
  /** Ventas del mes vs objetivo 7. */
  monthlySales: (n: number): Semaphore => semHigherBetter(n, 7, 5),
  /** Margen medio por operación (%). <4% = rojo. */
  marginPct: (pct: number): Semaphore => (pct >= 4 ? 'green' : pct >= 2 ? 'amber' : 'red'),
  /** Tiempo 1ª respuesta en horas: <24 verde, 24-48 ámbar, >48 rojo. */
  firstResponseHours: (h: number): Semaphore => semLowerBetter(h, 24, 48),
  /** Leads activos sin próxima acción: 0 verde, 1-5 ámbar, >5 rojo. */
  leadsWithoutAction: (n: number): Semaphore => (n === 0 ? 'green' : n <= 5 ? 'amber' : 'red'),
  /** Tiempo medio de venta en días: <15 verde, 15-30 ámbar, >30 rojo. */
  daysToSell: (d: number): Semaphore => semLowerBetter(d, 15, 30),
  /** % Trust Passport completado: ≥70 verde, 40-69 ámbar, <40 rojo. */
  trustPct: (pct: number): Semaphore => semHigherBetter(pct, 70, 40),
  /** % datos completos: ≥80 verde, 60-79 ámbar, <60 rojo. */
  dataPct: (pct: number): Semaphore => semHigherBetter(pct, 80, 60),
}

/** Umbrales de aging de stock (días publicado sin vender). */
export const STOCK_AGING_AMBER_DAYS = 30
export const STOCK_AGING_RED_DAYS = 45

/** Una reserva sin avanzar más de N días se marca como alerta. */
export const RESERVATION_STALE_DAYS = 7

/** Clases Tailwind por color de semáforo (texto). */
export const SEMAPHORE_TEXT: Record<Semaphore, string> = {
  green: 'text-green-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  gray: 'text-muted-foreground',
}

/** Color hex por semáforo (dots/badges). Alineado al semáforo del rebrand. */
export const SEMAPHORE_HEX: Record<Semaphore, string> = {
  green: '#1a9d5f',
  amber: '#c9820a',
  red: '#d64545',
  gray: '#8b94a3',
}
