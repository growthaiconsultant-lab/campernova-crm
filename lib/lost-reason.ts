import type { LostReason } from '@prisma/client'

/**
 * Motivo estructurado de pérdida/descarte (CAM-61).
 * Se usa tanto para compradores (PERDIDO) como para vendedores (DESCARTADO).
 */

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  PRECIO: 'Precio',
  FINANCIACION: 'Financiación',
  COMPRO_A_OTRO: 'Compró/vendió a otro',
  NO_RESPONDE: 'No responde',
  APLAZA: 'Aplaza la operación',
  SIN_STOCK: 'No hay stock que encaje',
  EXPECTATIVAS: 'Expectativas irreales',
  OTRO: 'Otro',
}

export const LOST_REASON_OPTIONS = (
  Object.entries(LOST_REASON_LABELS) as [LostReason, string][]
).map(([value, label]) => ({ value, label }))

export function isValidLostReason(value: string): value is LostReason {
  return value in LOST_REASON_LABELS
}
