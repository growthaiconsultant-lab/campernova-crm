import type { Prisma, VehicleStatus } from '@prisma/client'
import { createWarrantyForDelivery } from '@/lib/postventa'

/**
 * PR I3C3 — Finalización COORDINADA de entrega (núcleo transaccional).
 *
 * Evolución del núcleo de PR3 (que ya era atómico y usaba CAS): ahora se invoca DENTRO de la
 * transacción abierta por `withLockedRoots` (Vehicle → SellerLead → BuyerLead). Relee Delivery,
 * Vehicle, leads, Offer, checklist y firma BAJO el lock y valida contra lo releído (cierra el TOCTOU
 * de checklist/firma que antes vivía fuera de la transacción). Mantiene los CAS de Delivery y Vehicle
 * como segunda barrera y conserva todas las mutaciones atómicas de la venta.
 *
 * `I3C3 COORDINATES DELIVERY COMPLETION WITH THE ROOT LOCK PROTOCOL`
 * `COMPLETION IS TERMINAL AND NOT REVERSIBLE FROM THE NORMAL FLOW`
 * `ARCHIVED LEADS DO NOT BLOCK COMPLETING AN IN-PROGRESS DELIVERY`
 *
 * Todas las escrituras que hacen coherente una venta viven en la MISMA transacción: transición de la
 * entrega y del vehículo, cierre del comprador y del match, garantía, seguimientos y trazas. Un fallo
 * en cualquiera revierte todo. Los efectos externos (revalidate) van tras el commit, en la action.
 */

export type DeliveryCompletionErrorCode =
  | 'DELIVERY_NOT_FOUND'
  | 'DELIVERY_ROOT_CHANGED'
  | 'OFFER_MISMATCH'
  | 'DELIVERY_ALREADY_COMPLETED'
  | 'DELIVERY_ALREADY_CANCELLED'
  | 'DELIVERY_STATUS_CHANGED'
  | 'CHECKLIST_INCOMPLETE'
  | 'SIGNATURE_REQUIRED'

/** Mensajes visibles: sin ids, estado interno, SQL, Prisma ni PII. */
export const DELIVERY_COMPLETION_ERROR_MESSAGES: Record<DeliveryCompletionErrorCode, string> = {
  DELIVERY_NOT_FOUND: 'Entrega no encontrada',
  DELIVERY_ROOT_CHANGED:
    'Los datos de la entrega han cambiado mientras se procesaba. Inténtalo de nuevo.',
  OFFER_MISMATCH: 'La oferta ya no corresponde a este vehículo y comprador.',
  DELIVERY_ALREADY_COMPLETED: 'La entrega ya está completada.',
  DELIVERY_ALREADY_CANCELLED: 'La entrega está cancelada y no puede completarse.',
  DELIVERY_STATUS_CHANGED:
    'El estado de la entrega cambió mientras se procesaba. Vuelve a intentarlo.',
  CHECKLIST_INCOMPLETE: 'Hay ítems pendientes en el checklist de la entrega.',
  SIGNATURE_REQUIRED: 'La entrega requiere firma antes de completarse.',
}

/** Conflicto de negocio esperado al completar (validación pre-CAS). No es un error técnico. */
export class DeliveryCompletionError extends Error {
  readonly code: DeliveryCompletionErrorCode
  constructor(code: DeliveryCompletionErrorCode) {
    super(DELIVERY_COMPLETION_ERROR_MESSAGES[code])
    this.name = 'DeliveryCompletionError'
    this.code = code
  }
}

export function isDeliveryCompletionError(err: unknown): err is DeliveryCompletionError {
  return err instanceof DeliveryCompletionError
}

export type DeliveryConflictReason = 'delivery' | 'vehicle'

export const DELIVERY_CONFLICT_MESSAGES: Record<DeliveryConflictReason, string> = {
  delivery:
    'La entrega ya no está disponible para completarse (ya se completó o su estado cambió).',
  vehicle: 'El vehículo ya no está disponible para entregarse (su estado ha cambiado).',
}

/** Conflicto por CAS de 0 filas (concurrencia / estado incompatible). Segunda barrera. */
export class DeliveryConflictError extends Error {
  readonly reason: DeliveryConflictReason
  constructor(
    reason: DeliveryConflictReason,
    message: string = DELIVERY_CONFLICT_MESSAGES[reason]
  ) {
    super(message)
    this.name = 'DeliveryConflictError'
    this.reason = reason
  }
}

/** Estados del vehículo desde los que una entrega puede completarse (→ VENDIDO). */
export const DELIVERABLE_VEHICLE_STATUSES: VehicleStatus[] = ['PUBLICADO', 'RESERVADO']

export type CompleteDeliveryParams = {
  deliveryId: string
  vehicleId: string
  buyerLeadId: string
  /** `sellerLeadId` observado en la lectura preliminar; detecta cambio de raíz. */
  resolvedSellerLeadId: string | null
  actorId: string
  /** Instante de negocio de la compleción (completedAt / soldAt / garantía). Único. */
  now: Date
}

/** Semillas de test para forzar carrera o fallo determinista (sin efecto en producción). */
export type CompleteDeliveryHooks = {
  beforeDeliveryWrite?: () => Promise<void>
  beforeWarrantyWrite?: () => Promise<void>
  beforeFollowupsWrite?: () => Promise<void>
}

/**
 * Completa una entrega de forma ATÓMICA y COORDINADA dentro de `tx`. Debe invocarse dentro de
 * `withLockedRoots(...)` (que abre la transacción y adquiere los row locks de las raíces). Relee y
 * valida bajo el lock, luego escribe con CAS. Lanza `DeliveryCompletionError` (validación pre-CAS) o
 * `DeliveryConflictError` (CAS 0) → ambos revierten la transacción. Los efectos externos (revalidate)
 * NO van aquí.
 */
export async function completeDeliveryTx(
  tx: Prisma.TransactionClient,
  p: CompleteDeliveryParams,
  hooks: CompleteDeliveryHooks = {}
): Promise<{ warrantyId: string }> {
  // (1) Relectura de la entrega BAJO el lock (estado + raíces + oferta + checklist + firma).
  const delivery = await tx.delivery.findUnique({
    where: { id: p.deliveryId },
    select: {
      status: true,
      vehicleId: true,
      buyerLeadId: true,
      offerId: true,
      signedByName: true,
      signedByDni: true,
      signatureUrl: true,
      checklist: { select: { result: true } },
    },
  })
  if (!delivery) throw new DeliveryCompletionError('DELIVERY_NOT_FOUND')

  // (2) Coherencia de raíces: la entrega sigue colgando del mismo vehículo y comprador.
  if (delivery.vehicleId !== p.vehicleId || delivery.buyerLeadId !== p.buyerLeadId) {
    throw new DeliveryCompletionError('DELIVERY_ROOT_CHANGED')
  }
  const vehicle = await tx.vehicle.findUnique({
    where: { id: p.vehicleId },
    select: { status: true, sellerLeadId: true },
  })
  if (!vehicle || vehicle.sellerLeadId !== p.resolvedSellerLeadId) {
    throw new DeliveryCompletionError('DELIVERY_ROOT_CHANGED')
  }

  // (3) Existencia de leads (los ARCHIVADOS SÍ pueden completar; solo se exige que existan).
  if (vehicle.sellerLeadId) {
    const seller = await tx.sellerLead.findUnique({
      where: { id: vehicle.sellerLeadId },
      select: { id: true },
    })
    if (!seller) throw new DeliveryCompletionError('DELIVERY_ROOT_CHANGED')
  }
  const buyer = await tx.buyerLead.findUnique({
    where: { id: p.buyerLeadId },
    select: { id: true },
  })
  if (!buyer) throw new DeliveryCompletionError('DELIVERY_ROOT_CHANGED')

  // (4) Oferta coherente (offerId es obligatorio desde I3C1B). No se modifica su estado.
  const offer = await tx.offer.findUnique({
    where: { id: delivery.offerId },
    select: { vehicleId: true, buyerLeadId: true },
  })
  if (!offer) throw new DeliveryCompletionError('OFFER_MISMATCH')
  if (offer.vehicleId !== p.vehicleId || offer.buyerLeadId !== p.buyerLeadId) {
    throw new DeliveryCompletionError('OFFER_MISMATCH')
  }

  // (5) Clasificación del estado real (autoridad = lectura bajo lock). Precede a checklist/firma.
  if (delivery.status !== 'EN_CURSO') {
    if (delivery.status === 'COMPLETADA')
      throw new DeliveryCompletionError('DELIVERY_ALREADY_COMPLETED')
    if (delivery.status === 'CANCELADA')
      throw new DeliveryCompletionError('DELIVERY_ALREADY_CANCELLED')
    throw new DeliveryCompletionError('DELIVERY_STATUS_CHANGED')
  }

  // (6) Checklist completo (validado BAJO el lock, no con la lectura preliminar).
  if (delivery.checklist.some((c) => c.result === 'PENDIENTE')) {
    throw new DeliveryCompletionError('CHECKLIST_INCOMPLETE')
  }

  // (7) Firma obligatoria (mismos requisitos actuales: nombre + DNI + evidencia).
  if (!delivery.signedByName || !delivery.signedByDni || !delivery.signatureUrl) {
    throw new DeliveryCompletionError('SIGNATURE_REQUIRED')
  }

  await hooks.beforeDeliveryWrite?.()

  // (8) CAS de la entrega: EN_CURSO → COMPLETADA. count 0 → otra ejecución ganó → revierte.
  const deliveryRes = await tx.delivery.updateMany({
    where: { id: p.deliveryId, status: 'EN_CURSO' },
    data: { status: 'COMPLETADA', completedAt: p.now },
  })
  if (deliveryRes.count === 0) throw new DeliveryConflictError('delivery')

  // (9) CAS del vehículo: PUBLICADO|RESERVADO → VENDIDO. count 0 → estado incompatible → revierte.
  const vehicleRes = await tx.vehicle.updateMany({
    where: { id: p.vehicleId, status: { in: DELIVERABLE_VEHICLE_STATUSES } },
    data: { status: 'VENDIDO', soldAt: p.now },
  })
  if (vehicleRes.count === 0) throw new DeliveryConflictError('vehicle')

  // (10) Match en OFERTA de este par vehículo↔comprador → CERRADO (semántica vigente).
  await tx.match.updateMany({
    where: { vehicleId: p.vehicleId, buyerLeadId: p.buyerLeadId, status: 'OFERTA' },
    data: { status: 'CERRADO' },
  })

  // (11) Comprador → CERRADO (no se archiva; no se reactiva ni se toca `archivedAt`).
  await tx.buyerLead.update({
    where: { id: p.buyerLeadId },
    data: { status: 'CERRADO' },
  })

  // (12) Garantía obligatoria (única por entrega) + seguimientos DIA_7/DIA_30, en la MISMA tx.
  await hooks.beforeWarrantyWrite?.()
  const { warrantyId } = await createWarrantyForDelivery(p.deliveryId, tx, {
    beforeFollowupsWrite: hooks.beforeFollowupsWrite,
  })

  // (13) Trazas de cierre (timeline de comprador + vendedor). `sellerLeadId` = el releído.
  await tx.activity.create({
    data: {
      type: 'CAMBIO_ESTADO',
      content: 'Vehículo marcado como VENDIDO automáticamente al completar la entrega.',
      agentId: p.actorId,
      sellerLeadId: vehicle.sellerLeadId,
    },
  })
  await tx.activity.create({
    data: {
      type: 'ENTREGA_COMPLETADA',
      content: 'Entrega completada y firmada.',
      agentId: p.actorId,
      sellerLeadId: vehicle.sellerLeadId,
      buyerLeadId: p.buyerLeadId,
    },
  })
  await tx.activity.create({
    data: {
      type: 'GARANTIA_ACTIVADA',
      content: 'Garantía de 12 meses activada automáticamente.',
      agentId: p.actorId,
      sellerLeadId: vehicle.sellerLeadId,
      buyerLeadId: p.buyerLeadId,
    },
  })

  return { warrantyId }
}
