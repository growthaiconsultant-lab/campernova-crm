/**
 * Lógica PURA del archivado de leads (PR B2): etiquetas, validación de entrada y clasificación
 * de dependencias bloqueantes. Sin Prisma, sin red, sin efectos → totalmente testeable.
 */
import type { ArchiveReason, OfferStatus, VehicleStatus, DeliveryStatus } from '@prisma/client'
import { isActiveHold } from '@/lib/offers'
import type { ArchiveBlocker, ArchiveDependencyInput } from './types'

// ─── Motivos de archivado ─────────────────────────────────────────────────────

export const ARCHIVE_REASON_LABELS: Record<ArchiveReason, string> = {
  SIN_RESPUESTA: 'Sin respuesta',
  FUERA_DE_MERCADO: 'Fuera de mercado',
  POSIBLE_DUPLICADO: 'Posible duplicado',
  PRUEBA_INTERNA: 'Prueba interna',
  LIMPIEZA_BANDEJA: 'Limpieza de bandeja',
  OTRO: 'Otro',
}

export const ARCHIVE_REASON_OPTIONS = (Object.keys(ARCHIVE_REASON_LABELS) as ArchiveReason[]).map(
  (value) => ({ value, label: ARCHIVE_REASON_LABELS[value] })
)

export function isValidArchiveReason(v: unknown): v is ArchiveReason {
  return typeof v === 'string' && v in ARCHIVE_REASON_LABELS
}

/** Longitud máxima de las notas de archivado. */
export const ARCHIVE_NOTES_MAX_LENGTH = 500

export type ArchiveNotesValidation =
  | { ok: true; value: string | null }
  | { ok: false; reason: 'too_long' }

/**
 * Notas: se trimean; vacío → `null`; de 1 a 500 caracteres se aceptan; **más de 500 se RECHAZAN**.
 * No se truncan en silencio: truncar haría perder texto del operador sin avisar.
 */
export function validateArchiveNotes(notes?: string | null): ArchiveNotesValidation {
  const trimmed = notes?.trim() ?? ''
  if (trimmed.length === 0) return { ok: true, value: null }
  if (trimmed.length > ARCHIVE_NOTES_MAX_LENGTH) return { ok: false, reason: 'too_long' }
  return { ok: true, value: trimmed }
}

// ─── Estados que implican operativa activa ────────────────────────────────────

/**
 * Vehículo "en comercialización". Se corresponde con el inventario real que el CRM ya trata
 * como stock (`TASADO`, `PUBLICADO`, `RESERVADO`): el vehículo está en la nave y sigue
 * disponible o comprometido comercialmente.
 *
 * NO bloquean: `NUEVO` (aún sin tasar: fase previa al stock, el caso más habitual de archivado),
 * `VENDIDO` (expediente cerrado) ni `DESCARTADO` (fuera de mercado) — estados terminales sin
 * operativa activa.
 */
export const BLOCKING_VEHICLE_STATUSES: VehicleStatus[] = ['TASADO', 'PUBLICADO', 'RESERVADO']

const ALL_OFFER_STATUSES: OfferStatus[] = [
  'PROPUESTA',
  'CONTRAOFERTA',
  'ACEPTADA',
  'CONVERTIDA',
  'RECHAZADA',
  'EXPIRADA',
  'RETIRADA',
  'CANCELADA',
]

/**
 * Ofertas vivas: se DERIVAN del helper canónico `isActiveHold` (`lib/offers`) en vez de
 * redefinirlas, para que no puedan desincronizarse de las reglas de venta/reserva.
 */
export const ACTIVE_OFFER_STATUSES: OfferStatus[] = ALL_OFFER_STATUSES.filter(isActiveHold)

/** Entregas no terminales. `COMPLETADA` y `CANCELADA` no bloquean. */
export const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = ['PROGRAMADA', 'EN_CURSO']

/** Estados de evento que ya no representan trabajo futuro. */
export const TERMINAL_EVENT_STATUSES = ['COMPLETADO', 'CANCELADO', 'NO_SHOW'] as const

// ─── Clasificación de bloqueos (pura) ─────────────────────────────────────────

const PLURAL = (n: number, one: string, many: string) => (n === 1 ? one : many)

/**
 * Traduce las dependencias activas a una lista de bloqueos legible. Lista vacía ⇔ se puede
 * archivar. No devuelve PII: sólo tipo, cantidad y un mensaje genérico.
 */
export function classifyBlockers(input: ArchiveDependencyInput): ArchiveBlocker[] {
  const blockers: ArchiveBlocker[] = []

  if (
    input.vehicleStatus != null &&
    (BLOCKING_VEHICLE_STATUSES as string[]).includes(input.vehicleStatus)
  ) {
    blockers.push({
      type: 'VEHICLE_IN_STOCK',
      count: 1,
      message:
        'El vehículo sigue en comercialización. Cámbialo de estado antes de archivar el vendedor.',
    })
  }

  if (input.activeReservationCount > 0) {
    const n = input.activeReservationCount
    blockers.push({
      type: 'ACTIVE_RESERVATION',
      count: n,
      message: `Hay ${n} ${PLURAL(n, 'reserva con señal', 'reservas con señal')}. Resuélve${PLURAL(n, 'la', 'las')} antes de archivar.`,
    })
  }

  // Una reserva es también una oferta viva: se descuenta para no contar dos veces lo mismo.
  const offersWithoutReservations = Math.max(
    0,
    input.activeOfferCount - input.activeReservationCount
  )
  if (offersWithoutReservations > 0) {
    const n = offersWithoutReservations
    blockers.push({
      type: 'ACTIVE_OFFER',
      count: n,
      message: `Hay ${n} ${PLURAL(n, 'oferta viva', 'ofertas vivas')}. Ciérra${PLURAL(n, 'la', 'las')} antes de archivar.`,
    })
  }

  if (input.activeDeliveryCount > 0) {
    const n = input.activeDeliveryCount
    blockers.push({
      type: 'ACTIVE_DELIVERY',
      count: n,
      message: `Hay ${n} ${PLURAL(n, 'entrega programada o en curso', 'entregas programadas o en curso')}.`,
    })
  }

  if (input.hasPendingNextAction) {
    blockers.push({
      type: 'PENDING_NEXT_ACTION',
      count: 1,
      message:
        'Hay una próxima acción pendiente (incluidas las vencidas). Complétala o elimínala antes de archivar.',
    })
  }

  if (input.futureEventCount > 0) {
    const n = input.futureEventCount
    blockers.push({
      type: 'FUTURE_EVENT',
      count: n,
      message: `Hay ${n} ${PLURAL(n, 'evento futuro en el calendario', 'eventos futuros en el calendario')}. Complétalo${PLURAL(n, '', 's')} o cancélalo${PLURAL(n, '', 's')} antes de archivar.`,
    })
  }

  return blockers
}
