/**
 * Tipos del archivado real de leads (PR B2).
 *
 * El archivado es ORTOGONAL al estado comercial: `archivedAt == null` ⇔ activo. Archivar no
 * cambia `SellerLeadStatus`/`BuyerLeadStatus`, ni `lostReason`, ni vehículo, ofertas, reservas,
 * entregas, documentos o KPIs. Reactivar sólo retira la condición de archivado.
 */
import type { ArchiveReason } from '@prisma/client'

/** Tipos de dependencia activa que impiden archivar. */
export type ArchiveBlockerType =
  | 'VEHICLE_IN_STOCK' // vehículo en comercialización (tasado / publicado / reservado)
  | 'ACTIVE_OFFER' // oferta viva (ocupa el vehículo)
  | 'ACTIVE_RESERVATION' // oferta aceptada con señal > 0
  | 'ACTIVE_DELIVERY' // entrega programada o en curso
  | 'PENDING_NEXT_ACTION' // próxima acción comercial sin resolver (incluida la vencida)
  | 'FUTURE_EVENT' // evento de calendario futuro no cancelado/completado

/** Bloqueo individual: tipo + cuántas dependencias + mensaje para el operador. Sin PII. */
export type ArchiveBlocker = {
  type: ArchiveBlockerType
  count: number
  message: string
}

/** Datos planos necesarios para clasificar bloqueos. Los carga `prisma-deps`. */
export type ArchiveDependencyInput = {
  /** Estado del vehículo asociado (solo vendedores); `null` si no hay vehículo. */
  vehicleStatus?: string | null
  /** Ofertas vivas (`isActiveHold`). */
  activeOfferCount: number
  /** Ofertas aceptadas con señal > 0 (`isReservation`). */
  activeReservationCount: number
  /** Entregas PROGRAMADA / EN_CURSO. */
  activeDeliveryCount: number
  /** Próxima acción comercial pendiente (cualquiera, vencida incluida). */
  hasPendingNextAction: boolean
  /** Eventos de calendario futuros en estado no terminal. */
  futureEventCount: number
}

/** Entrada validada de archivado. */
export type ArchiveInput = {
  leadId: string
  reason: ArchiveReason
  notes?: string | null
}

/** Resultado de archivar. `blocked` incluye el detalle para que PR C lo pinte. */
export type ArchiveOutcome =
  | { status: 'archived' }
  | { status: 'already_archived' }
  | { status: 'blocked'; code: 'ARCHIVE_BLOCKED'; blockers: ArchiveBlocker[] }
  | { status: 'error'; message: string }

/** Resultado de reactivar. */
export type ReactivateOutcome =
  | { status: 'reactivated' }
  | { status: 'already_active' }
  | { status: 'error'; message: string }
