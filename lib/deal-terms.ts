import type { SellerDealType, SellerUrgency, SellerRisk } from '@prisma/client'

/**
 * Block 17 — Condiciones estructuradas de la operación con el vendedor
 * (Seller Supply Graph). Módulo puro: labels, opciones, colores y validadores.
 * La modalidad de acuerdo, la urgencia y el riesgo dejan de vivir en notas
 * libres para poder priorizar captación y alimentar el scoring (Block 19).
 */

export const SELLER_DEAL_TYPE_LABELS: Record<SellerDealType, string> = {
  DEPOSITO_VENTA: 'Depósito-venta',
  COMPRA_DIRECTA: 'Compra directa',
  PARTE_PAGO: 'Parte de pago',
  INDECISO: 'Sin decidir',
}

export const SELLER_URGENCY_LABELS: Record<SellerUrgency, string> = {
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
}

/** Color por urgencia (dot/badge). */
export const SELLER_URGENCY_COLORS: Record<SellerUrgency, string> = {
  ALTA: '#dc2626',
  MEDIA: '#d97706',
  BAJA: '#64748b',
}

export const SELLER_RISK_LABELS: Record<SellerRisk, string> = {
  BAJO: 'Bajo',
  MEDIO: 'Medio',
  ALTO: 'Alto',
}

/** Color por nivel de riesgo (dot/badge). */
export const SELLER_RISK_COLORS: Record<SellerRisk, string> = {
  BAJO: '#1f8a5b',
  MEDIO: '#d97706',
  ALTO: '#dc2626',
}

export const SELLER_DEAL_TYPE_OPTIONS = (
  Object.entries(SELLER_DEAL_TYPE_LABELS) as [SellerDealType, string][]
).map(([value, label]) => ({ value, label }))

export const SELLER_URGENCY_OPTIONS = (
  Object.entries(SELLER_URGENCY_LABELS) as [SellerUrgency, string][]
).map(([value, label]) => ({ value, label }))

export const SELLER_RISK_OPTIONS = (
  Object.entries(SELLER_RISK_LABELS) as [SellerRisk, string][]
).map(([value, label]) => ({ value, label }))

export function isValidSellerDealType(v: string): v is SellerDealType {
  return v in SELLER_DEAL_TYPE_LABELS
}
export function isValidSellerUrgency(v: string): v is SellerUrgency {
  return v in SELLER_URGENCY_LABELS
}
export function isValidSellerRisk(v: string): v is SellerRisk {
  return v in SELLER_RISK_LABELS
}
