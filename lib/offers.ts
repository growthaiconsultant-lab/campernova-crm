import type { OfferStatus } from '@prisma/client'

/**
 * Block 18 — Ofertas y Reservas (Transaction & Financing Layer).
 * Módulo puro: labels, colores, opciones y máquina de estados de la oferta.
 * Una oferta ACEPTADA con señal (`depositAmount`) es una **reserva**.
 * La venta final (Vehicle VENDIDO) sigue viviendo en el flujo de Delivery.
 */

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  PROPUESTA: 'Propuesta',
  CONTRAOFERTA: 'Contraoferta',
  ACEPTADA: 'Aceptada',
  CONVERTIDA: 'Convertida en venta',
  RECHAZADA: 'Rechazada',
  EXPIRADA: 'Expirada',
  RETIRADA: 'Retirada',
  CANCELADA: 'Cancelada',
}

export const OFFER_STATUS_COLORS: Record<OfferStatus, string> = {
  PROPUESTA: '#2563eb',
  CONTRAOFERTA: '#7c3aed',
  ACEPTADA: '#0891b2',
  CONVERTIDA: '#1f8a5b',
  RECHAZADA: '#dc2626',
  EXPIRADA: '#64748b',
  RETIRADA: '#64748b',
  CANCELADA: '#dc2626',
}

export const OFFER_STATUS_OPTIONS = (
  Object.entries(OFFER_STATUS_LABELS) as [OfferStatus, string][]
).map(([value, label]) => ({ value, label }))

/** Transiciones válidas de la oferta. Los estados sin entrada son terminales. */
export const OFFER_TRANSITIONS: Partial<Record<OfferStatus, OfferStatus[]>> = {
  PROPUESTA: ['CONTRAOFERTA', 'ACEPTADA', 'RECHAZADA', 'EXPIRADA', 'RETIRADA'],
  CONTRAOFERTA: ['ACEPTADA', 'RECHAZADA', 'EXPIRADA', 'RETIRADA'],
  ACEPTADA: ['CONVERTIDA', 'CANCELADA'],
}

export function isValidOfferTransition(from: OfferStatus, to: OfferStatus): boolean {
  return OFFER_TRANSITIONS[from]?.includes(to) ?? false
}

/** Estados sin transiciones de salida (cerrados). */
export function isTerminalOfferStatus(s: OfferStatus): boolean {
  return !OFFER_TRANSITIONS[s]
}

export function isValidOfferStatus(v: string): v is OfferStatus {
  return v in OFFER_STATUS_LABELS
}

/** Una oferta aceptada con señal es una reserva activa (retiene el vehículo). */
export function isReservation(status: OfferStatus, depositAmount: number | null): boolean {
  return status === 'ACEPTADA' && depositAmount != null && depositAmount > 0
}

/** Estados en los que la oferta "ocupa" el vehículo (bloquea el stock). */
export function isActiveHold(status: OfferStatus): boolean {
  return status === 'PROPUESTA' || status === 'CONTRAOFERTA' || status === 'ACEPTADA'
}
