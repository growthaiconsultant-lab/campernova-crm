import type { OfferStatus, Prisma, LostReason } from '@prisma/client'

/**
 * PR2 — Reserva atómica de ofertas (núcleo transaccional).
 *
 * La disponibilidad del vehículo NO se decide con una lectura previa (patrón
 * check-then-act, sujeto a carrera), sino con escrituras condicionales
 * (compare-and-swap) DENTRO de la misma transacción que cambia la oferta:
 *  - la oferta transiciona solo desde su estado esperado;
 *  - al ACEPTAR, el vehículo pasa de PUBLICADO a RESERVADO solo si sigue PUBLICADO.
 * Si cualquiera de las dos escrituras afecta 0 filas, otro proceso ganó la carrera:
 * se lanza `OfferConflictError` y la transacción revierte por completo. Así dos
 * aceptaciones concurrentes sobre el mismo vehículo no pueden reservarlo ambas, ni
 * puede aceptarse dos veces la misma oferta.
 */

export type OfferConflictReason = 'offer' | 'vehicle'

export const OFFER_CONFLICT_MESSAGES: Record<OfferConflictReason, string> = {
  offer: 'La oferta ya no está disponible para ser aceptada.',
  vehicle: 'El vehículo ya no está disponible para reservar.',
}

/** Conflicto de negocio esperado por concurrencia (NO un error técnico). */
export class OfferConflictError extends Error {
  readonly reason: OfferConflictReason
  constructor(reason: OfferConflictReason, message: string = OFFER_CONFLICT_MESSAGES[reason]) {
    super(message)
    this.name = 'OfferConflictError'
    this.reason = reason
  }
}

export type ApplyOfferStatusParams = {
  offerId: string
  /** Estado actual esperado de la oferta (CAS): la transición solo procede desde aquí. */
  fromStatus: OfferStatus
  toStatus: OfferStatus
  /** Campos adicionales a escribir en la oferta (undefined = no tocar). */
  offerData: {
    rejectionReason?: LostReason
    depositAmount?: number
    reservedUntil?: Date | null
    amount?: number
  }
  vehicleId: string
  /** true al ACEPTAR: exige PUBLICADO → RESERVADO de forma atómica. */
  reserve: boolean
  /** true al liberar una reserva (cancelar/retirar/expirar): RESERVADO → PUBLICADO. */
  release: boolean
  /** Contenido de la actividad de timeline (idéntico en ambos lados). */
  activityContent: string
  actorId: string
  buyerLeadId: string
  sellerLeadId: string | null
}

/** Semilla de test para forzar solapamiento real de transacciones (sin efecto en producción). */
export type ApplyOfferStatusHooks = {
  beforeVehicleWrite?: () => Promise<void>
}

/**
 * Aplica el cambio de estado de una oferta de forma ATÓMICA dentro de `tx`.
 * Debe invocarse dentro de `db.$transaction(...)`. Lanza `OfferConflictError` (que
 * provoca el rollback de la transacción) si pierde cualquiera de los compare-and-swap.
 * Los efectos externos (KPI, emails, revalidación) NO van aquí: se ejecutan tras el commit.
 */
export async function applyOfferStatusChangeTx(
  tx: Prisma.TransactionClient,
  p: ApplyOfferStatusParams,
  hooks: ApplyOfferStatusHooks = {}
): Promise<{ reserved: boolean; released: boolean }> {
  // 1) Oferta: compare-and-swap desde el estado esperado. count === 0 → la oferta ya
  //    cambió (p. ej. fue aceptada por otra ejecución concurrente) → conflicto.
  const offerRes = await tx.offer.updateMany({
    where: { id: p.offerId, status: p.fromStatus },
    data: {
      status: p.toStatus,
      decidedAt: new Date(),
      rejectionReason: p.offerData.rejectionReason,
      depositAmount: p.offerData.depositAmount,
      reservedUntil: p.offerData.reservedUntil,
      amount: p.offerData.amount,
    },
  })
  if (offerRes.count === 0) throw new OfferConflictError('offer')

  // Punto de sincronización determinista solo para tests de concurrencia.
  await hooks.beforeVehicleWrite?.()

  // 2) Vehículo: reserva/liberación condicional (mismo orden en toda ejecución).
  let reserved = false
  let released = false
  if (p.reserve) {
    // Compare-and-swap: solo reserva si sigue PUBLICADO. count === 0 → otro proceso lo
    // reservó/vendió/retiró entre medias → conflicto (revierte la aceptación de la oferta).
    const vehRes = await tx.vehicle.updateMany({
      where: { id: p.vehicleId, status: 'PUBLICADO' },
      data: { status: 'RESERVADO' },
    })
    if (vehRes.count === 0) throw new OfferConflictError('vehicle')
    reserved = true
  } else if (p.release) {
    // Solo libera un vehículo que siga RESERVADO; nunca "publica" uno vendido/otro estado.
    const vehRes = await tx.vehicle.updateMany({
      where: { id: p.vehicleId, status: 'RESERVADO' },
      data: { status: 'PUBLICADO' },
    })
    released = vehRes.count > 0
  }

  // 3) Timeline en ambos lados (comprador + vendedor).
  await tx.activity.create({
    data: {
      type: 'OFERTA_ACTUALIZADA',
      content: p.activityContent,
      agentId: p.actorId,
      buyerLeadId: p.buyerLeadId,
    },
  })
  if (p.sellerLeadId) {
    await tx.activity.create({
      data: {
        type: 'OFERTA_ACTUALIZADA',
        content: p.activityContent,
        agentId: p.actorId,
        sellerLeadId: p.sellerLeadId,
      },
    })
  }

  return { reserved, released }
}

/** Determina si un cambio de estado de oferta debe reservar el vehículo. */
export function shouldReserveVehicle(toStatus: OfferStatus): boolean {
  return toStatus === 'ACEPTADA'
}

/** Determina si un cambio de estado libera una reserva viva (oferta que estaba ACEPTADA). */
export function shouldReleaseVehicle(fromStatus: OfferStatus, toStatus: OfferStatus): boolean {
  const releasing = toStatus === 'CANCELADA' || toStatus === 'RETIRADA' || toStatus === 'EXPIRADA'
  return releasing && fromStatus === 'ACEPTADA'
}
