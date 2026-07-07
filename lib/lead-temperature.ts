import type { LeadTemperature } from '@prisma/client'

/**
 * Temperatura comercial del lead comprador (CAM-62).
 * Módulo puro: labels, colores y sugerencia inicial desde el plazo de compra.
 */

export const TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  HOT: 'Caliente',
  WARM: 'Templado',
  COLD: 'Frío',
}

/** Colores para el chip (fondo suave + texto). */
export const TEMPERATURE_COLORS: Record<
  LeadTemperature,
  { bg: string; text: string; dot: string }
> = {
  HOT: { bg: '#fef2f2', text: '#dc2626', dot: '#dc2626' },
  WARM: { bg: '#fffbeb', text: '#d97706', dot: '#f59e0b' },
  COLD: { bg: '#f0f9ff', text: '#0369a1', dot: '#38bdf8' },
}

export const TEMPERATURE_OPTIONS = (
  Object.entries(TEMPERATURE_LABELS) as [LeadTemperature, string][]
).map(([value, label]) => ({ value, label }))

export function isValidTemperature(value: string): value is LeadTemperature {
  return value in TEMPERATURE_LABELS
}

/**
 * Sugerencia inicial de temperatura al crear el lead, según el plazo de compra
 * declarado (valores de PURCHASE_TIMELINE_OPTIONS). Heurística simple v1:
 * <1 mes → HOT · 1-3 meses → WARM · resto (o desconocido) → COLD.
 */
export function suggestTemperatureFromTimeline(
  purchaseTimeline: string | null | undefined
): LeadTemperature {
  switch (purchaseTimeline) {
    case 'menos_1_mes':
      return 'HOT'
    case '1_3_meses':
      return 'WARM'
    default:
      return 'COLD'
  }
}
