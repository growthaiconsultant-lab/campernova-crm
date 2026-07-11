import type { Prisma, VehicleStatus } from '@prisma/client'
import { createWarrantyForDelivery } from '@/lib/postventa'

/**
 * PR3 — Finalización atómica de entrega (núcleo transaccional).
 *
 * Corrige NEG-02: antes, la entrega se marcaba COMPLETADA dentro de una transacción y
 * la garantía + los seguimientos de posventa se creaban DESPUÉS del commit; si esa
 * segunda fase fallaba, la entrega quedaba completada pero sin garantía ni seguimientos.
 *
 * Aquí todas las escrituras que hacen coherente una entrega completada viven en la MISMA
 * transacción: transición de la entrega, del vehículo, cierre del comprador y del match,
 * garantía, seguimientos y trazas. La disponibilidad NO se decide con una lectura previa,
 * sino con escrituras condicionales (compare-and-swap):
 *  - la entrega transiciona solo desde EN_CURSO;
 *  - el vehículo pasa a VENDIDO solo desde un estado entregable (PUBLICADO/RESERVADO).
 * Si cualquiera de los dos CAS afecta 0 filas, otra ejecución ganó la carrera o el estado
 * es incompatible → se lanza `DeliveryConflictError` y la transacción revierte por completo.
 */

export type DeliveryConflictReason = 'delivery' | 'vehicle'

export const DELIVERY_CONFLICT_MESSAGES: Record<DeliveryConflictReason, string> = {
  delivery:
    'La entrega ya no está disponible para completarse (ya se completó o su estado cambió).',
  vehicle: 'El vehículo ya no está disponible para entregarse (su estado ha cambiado).',
}

/** Conflicto de negocio esperado por concurrencia / estado incompatible (NO un error técnico). */
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
  /** Vendedor del vehículo (para las trazas). Puede ser null si el vehículo no tiene lead. */
  sellerLeadId: string | null
  actorId: string
  /** Instante de finalización (completedAt / soldAt), inyectado por la Server Action. */
  now: Date
}

/** Semillas de test para forzar carrera o fallo determinista (sin efecto en producción). */
export type CompleteDeliveryHooks = {
  beforeDeliveryWrite?: () => Promise<void>
  beforeWarrantyWrite?: () => Promise<void>
  beforeFollowupsWrite?: () => Promise<void>
}

/**
 * Completa una entrega de forma ATÓMICA dentro de `tx`. Debe invocarse dentro de
 * `db.$transaction(...)`. Lanza `DeliveryConflictError` (que provoca el rollback) si pierde
 * cualquiera de los compare-and-swap. Los efectos externos (emails, revalidación) NO van
 * aquí: se ejecutan tras el commit, en la Server Action.
 *
 * Orden determinista (reduce el riesgo de deadlock): entrega → vehículo → match →
 * comprador → garantía + seguimientos → trazas.
 */
export async function completeDeliveryTx(
  tx: Prisma.TransactionClient,
  p: CompleteDeliveryParams,
  hooks: CompleteDeliveryHooks = {}
): Promise<{ warrantyId: string }> {
  // Punto de sincronización de tests para forzar la carrera en el CAS de la entrega.
  await hooks.beforeDeliveryWrite?.()

  // 1) CAS de la entrega: EN_CURSO → COMPLETADA. count 0 → ya se completó / cambió de estado.
  const deliveryRes = await tx.delivery.updateMany({
    where: { id: p.deliveryId, status: 'EN_CURSO' },
    data: { status: 'COMPLETADA', completedAt: p.now },
  })
  if (deliveryRes.count === 0) throw new DeliveryConflictError('delivery')

  // 2) CAS del vehículo: PUBLICADO|RESERVADO → VENDIDO. count 0 → estado incompatible
  //    (p. ej. ya vendido/descartado) → revierte también el CAS de la entrega.
  const vehicleRes = await tx.vehicle.updateMany({
    where: { id: p.vehicleId, status: { in: DELIVERABLE_VEHICLE_STATUSES } },
    data: { status: 'VENDIDO', soldAt: p.now },
  })
  if (vehicleRes.count === 0) throw new DeliveryConflictError('vehicle')

  // 3) Match en OFERTA de este par vehículo↔comprador → CERRADO.
  await tx.match.updateMany({
    where: { vehicleId: p.vehicleId, buyerLeadId: p.buyerLeadId, status: 'OFERTA' },
    data: { status: 'CERRADO' },
  })

  // 4) Comprador → CERRADO.
  await tx.buyerLead.update({
    where: { id: p.buyerLeadId },
    data: { status: 'CERRADO' },
  })

  // 5) Garantía obligatoria (única por entrega) + seguimientos DIA_7/DIA_30, en la MISMA tx.
  await hooks.beforeWarrantyWrite?.()
  const { warrantyId } = await createWarrantyForDelivery(p.deliveryId, tx, {
    beforeFollowupsWrite: hooks.beforeFollowupsWrite,
  })

  // 6) Trazas de cierre (timeline de comprador + vendedor).
  await tx.activity.create({
    data: {
      type: 'CAMBIO_ESTADO',
      content: 'Vehículo marcado como VENDIDO automáticamente al completar la entrega.',
      agentId: p.actorId,
      sellerLeadId: p.sellerLeadId,
    },
  })
  await tx.activity.create({
    data: {
      type: 'ENTREGA_COMPLETADA',
      content: 'Entrega completada y firmada.',
      agentId: p.actorId,
      sellerLeadId: p.sellerLeadId,
      buyerLeadId: p.buyerLeadId,
    },
  })
  await tx.activity.create({
    data: {
      type: 'GARANTIA_ACTIVADA',
      content: 'Garantía de 12 meses activada automáticamente.',
      agentId: p.actorId,
      sellerLeadId: p.sellerLeadId,
      buyerLeadId: p.buyerLeadId,
    },
  })

  return { warrantyId }
}
