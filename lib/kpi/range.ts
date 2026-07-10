/**
 * Rangos de fecha de los filtros globales de Analytics (rediseño, spec §3).
 * Puro y testeable. El "periodo anterior" para la comparativa es siempre el
 * periodo de IGUAL duración inmediatamente anterior al inicio del rango —
 * uniforme para todos los rangos y fácil de explicar en el tooltip.
 */

export type RangeKey = '7d' | '30d' | '90d' | 'mes' | 'mes-anterior' | 'trimestre' | 'ano'

export const DEFAULT_RANGE: RangeKey = '30d'

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: '90d', label: '90 días' },
  { key: 'mes', label: 'Mes actual' },
  { key: 'mes-anterior', label: 'Mes anterior' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'ano', label: 'Año' },
]

export function isValidRangeKey(v: string | undefined | null): v is RangeKey {
  return !!v && RANGE_OPTIONS.some((o) => o.key === v)
}

export type ResolvedRange = {
  key: RangeKey
  label: string
  /** Inicio del periodo (incluido). */
  start: Date
  /** Fin del periodo (excluido; normalmente "ahora"). */
  end: Date
  /** Periodo anterior de igual duración, para la comparativa. */
  prevStart: Date
  prevEnd: Date
}

const DAY = 24 * 60 * 60 * 1000

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

export function resolveRange(key: string | undefined, now: Date = new Date()): ResolvedRange {
  const k: RangeKey = isValidRangeKey(key) ? key : DEFAULT_RANGE

  let start: Date
  let end: Date = now

  switch (k) {
    case '7d':
      start = new Date(now.getTime() - 7 * DAY)
      break
    case '30d':
      start = new Date(now.getTime() - 30 * DAY)
      break
    case '90d':
      start = new Date(now.getTime() - 90 * DAY)
      break
    case 'mes':
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
      break
    case 'mes-anterior': {
      start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      end = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
      break
    }
    case 'trimestre': {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3
      start = startOfDay(new Date(now.getFullYear(), qStartMonth, 1))
      break
    }
    case 'ano':
      start = startOfDay(new Date(now.getFullYear(), 0, 1))
      break
  }

  const duration = end.getTime() - start.getTime()
  const prevEnd = start
  const prevStart = new Date(start.getTime() - duration)

  const label = RANGE_OPTIONS.find((o) => o.key === k)!.label
  return { key: k, label, start, end, prevStart, prevEnd }
}
