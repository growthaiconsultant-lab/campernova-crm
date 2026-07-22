/**
 * PR I3C2 — Transiciones y cancelación coordinadas de Delivery (núcleo transaccional).
 *
 * Coordina EXCLUSIVAMENTE las transiciones NO terminales:
 *   PROGRAMADA → EN_CURSO · PROGRAMADA → CANCELADA · EN_CURSO → CANCELADA
 *
 * `I3C2 COORDINATES PROGRAMADA TO EN_CURSO`
 * `I3C2 COORDINATES DELIVERY CANCELLATION`
 * `DELIVERY CANCELLATION DOES NOT RELEASE THE VEHICLE`
 * `DELIVERY CANCELLATION DOES NOT MODIFY THE OFFER`
 * `CANCELLATION REASON AND ACTIVITY ARE ATOMIC`
 * `I3C2 USES CAS AND THE ROOT LOCK PROTOCOL`
 * `DELIVERY COMPLETION REMAINS IN I3C3`
 *
 * La COMPLECIÓN (EN_CURSO → COMPLETADA) y todos sus efectos (Vehicle→VENDIDO, Warranty, follow-ups,
 * Match/Buyer) permanecen en `lib/delivery-completion.ts` (I3C3) y NO pasan por este núcleo.
 *
 * Debe invocarse DENTRO de la transacción abierta por `withLockedRoots` (Vehicle → SellerLead →
 * BuyerLead). Relee todo bajo el lock, valida contra lo releído y escribe con compare-and-swap.
 * El CAS es obligatorio aunque existan locks: protege frente a clientes obsoletos, doble submit,
 * writers futuros y `completeDeliveryTx`, que todavía NO usa `withLockedRoots` (I3C3). El row-lock de
 * PostgreSQL serializa el CAS de la cancelación con el CAS de la compleción: si la cancelación gana,
 * la compleción falla su CAS y revierte por completo; si gana la compleción, la cancelación observa
 * `DELIVERY_ALREADY_COMPLETED` y no escribe nada. Nunca puede quedar CANCELADA junto a Vehicle
 * VENDIDO / Warranty / follow-ups.
 */
import type { Prisma, DeliveryStatus } from '@prisma/client'

export type DeliveryTransitionErrorCode =
  | 'DELIVERY_NOT_FOUND'
  | 'DELIVERY_ROOT_CHANGED'
  | 'LEAD_ARCHIVED'
  | 'INVALID_DELIVERY_TRANSITION'
  | 'DELIVERY_STATUS_CHANGED'
  | 'DELIVERY_ALREADY_CANCELLED'
  | 'DELIVERY_ALREADY_COMPLETED'
  | 'CANCELLATION_REASON_REQUIRED'

/** Mensajes visibles: sin ids, estado interno, SQL, Prisma, stack ni PII. */
export const DELIVERY_TRANSITION_ERROR_MESSAGES: Record<DeliveryTransitionErrorCode, string> = {
  DELIVERY_NOT_FOUND: 'Entrega no encontrada',
  DELIVERY_ROOT_CHANGED:
    'Los datos de la entrega han cambiado mientras se procesaba. Inténtalo de nuevo.',
  LEAD_ARCHIVED: 'No se puede iniciar la entrega de un lead archivado. Reactívalo primero.',
  INVALID_DELIVERY_TRANSITION: 'Esa transición de la entrega no está permitida.',
  DELIVERY_STATUS_CHANGED:
    'El estado de la entrega cambió mientras se procesaba. Vuelve a intentarlo.',
  DELIVERY_ALREADY_CANCELLED: 'La entrega ya está cancelada.',
  DELIVERY_ALREADY_COMPLETED: 'La entrega ya está completada.',
  CANCELLATION_REASON_REQUIRED: 'Indica el motivo de la cancelación.',
}

/** Conflicto de negocio esperado en una transición de entrega. No es un error técnico. */
export class DeliveryTransitionError extends Error {
  readonly code: DeliveryTransitionErrorCode
  constructor(code: DeliveryTransitionErrorCode) {
    super(DELIVERY_TRANSITION_ERROR_MESSAGES[code])
    this.name = 'DeliveryTransitionError'
    this.code = code
  }
}

export function isDeliveryTransitionError(err: unknown): err is DeliveryTransitionError {
  return err instanceof DeliveryTransitionError
}

/** Estados de partida que I3C2 coordina (no terminales, no COMPLETADA). */
export type DeliveryTransitionSource = 'PROGRAMADA' | 'EN_CURSO'
/** Estados destino que I3C2 coordina (COMPLETADA se excluye: es I3C3). */
export type DeliveryTransitionTarget = 'EN_CURSO' | 'CANCELADA'

/** Máquina de estados de I3C2 (subconjunto sin COMPLETADA). */
export const I3C2_ALLOWED_TRANSITIONS: Record<
  DeliveryTransitionSource,
  DeliveryTransitionTarget[]
> = {
  PROGRAMADA: ['EN_CURSO', 'CANCELADA'],
  EN_CURSO: ['CANCELADA'],
}

export function isI3C2Transition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  if (from !== 'PROGRAMADA' && from !== 'EN_CURSO') return false
  return (I3C2_ALLOWED_TRANSITIONS[from] as DeliveryStatus[]).includes(to)
}

/** Longitud máxima del motivo (coherente con la columna `cancellationReason`, texto libre). */
export const CANCELLATION_REASON_MAX = 500

export type TransitionDeliveryParams = {
  deliveryId: string
  vehicleId: string
  buyerLeadId: string
  /** `sellerLeadId` observado en la lectura preliminar; detecta cambio de raíz. */
  resolvedSellerLeadId: string | null
  expectedCurrentStatus: DeliveryTransitionSource
  targetStatus: DeliveryTransitionTarget
  actorId: string
  /** Obligatorio y no vacío cuando `targetStatus === 'CANCELADA'`. */
  cancellationReason: string | null
  now: Date
}

export type TransitionDeliveryHooks = {
  /** Sincronización determinista para tests de concurrencia (antes del CAS). */
  beforeWrite?: () => Promise<void>
}

export type TransitionDeliveryResult = {
  previousStatus: DeliveryStatus
  newStatus: DeliveryTransitionTarget
}

/**
 * Aplica la transición dentro de `tx` (abierta por `withLockedRoots`), tras releer y validar
 * raíces/archivado/estado, con CAS sobre el estado esperado y Activity en la misma transacción.
 */
export async function transitionDeliveryTx(
  tx: Prisma.TransactionClient,
  p: TransitionDeliveryParams,
  hooks: TransitionDeliveryHooks = {}
): Promise<TransitionDeliveryResult> {
  // (1) Relectura de la entrega y consistencia de raíz.
  const delivery = await tx.delivery.findUnique({
    where: { id: p.deliveryId },
    select: { status: true, vehicleId: true, buyerLeadId: true },
  })
  if (!delivery) throw new DeliveryTransitionError('DELIVERY_NOT_FOUND')
  if (delivery.vehicleId !== p.vehicleId || delivery.buyerLeadId !== p.buyerLeadId) {
    throw new DeliveryTransitionError('DELIVERY_ROOT_CHANGED')
  }

  // (2) Vehículo: existe y sigue colgando del mismo vendedor.
  const vehicle = await tx.vehicle.findUnique({
    where: { id: p.vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle || vehicle.sellerLeadId !== p.resolvedSellerLeadId) {
    throw new DeliveryTransitionError('DELIVERY_ROOT_CHANGED')
  }

  // (3) Vendedor (si existe) y comprador: deben EXISTIR (relectura de raíz). El bloqueo por
  //     archivado se decide más abajo según el destino: iniciar lo exige, cancelar no.
  let sellerArchived = false
  if (vehicle.sellerLeadId) {
    const seller = await tx.sellerLead.findUnique({
      where: { id: vehicle.sellerLeadId },
      select: { archivedAt: true },
    })
    if (!seller) throw new DeliveryTransitionError('DELIVERY_ROOT_CHANGED')
    sellerArchived = seller.archivedAt != null
  }
  const buyer = await tx.buyerLead.findUnique({
    where: { id: p.buyerLeadId },
    select: { archivedAt: true },
  })
  if (!buyer) throw new DeliveryTransitionError('DELIVERY_ROOT_CHANGED')
  const buyerArchived = buyer.archivedAt != null

  // (4) El estado releído debe coincidir con la expectativa del llamante (cliente no obsoleto). Se
  //     evalúa ANTES que el archivado para que la clasificación terminal (ALREADY_*/STATUS_CHANGED)
  //     sea determinista y no quede oculta por un lead archivado.
  if (delivery.status !== p.expectedCurrentStatus) {
    if (delivery.status === 'CANCELADA')
      throw new DeliveryTransitionError('DELIVERY_ALREADY_CANCELLED')
    if (delivery.status === 'COMPLETADA')
      throw new DeliveryTransitionError('DELIVERY_ALREADY_COMPLETED')
    throw new DeliveryTransitionError('DELIVERY_STATUS_CHANGED')
  }

  // (5) Transición válida en el subconjunto de I3C2 (COMPLETADA queda fuera).
  if (!isI3C2Transition(delivery.status, p.targetStatus)) {
    throw new DeliveryTransitionError('INVALID_DELIVERY_TRANSITION')
  }

  // (6) Archivado: bloquea INICIAR una entrega (avanzar el proceso) pero NO cancelarla. Cancelar es
  //     un cierre administrativo ante una incidencia; no reactiva ni modifica leads, no libera el
  //     vehículo y no toca la oferta. `ARCHIVED LEADS BLOCK STARTING A DELIVERY` ·
  //     `ARCHIVED LEADS DO NOT BLOCK CANCELLING A DELIVERY`.
  if (p.targetStatus === 'EN_CURSO' && (sellerArchived || buyerArchived)) {
    throw new DeliveryTransitionError('LEAD_ARCHIVED')
  }

  // (7) Motivo de cancelación: obligatorio, no vacío, acotado.
  let reason: string | null = null
  if (p.targetStatus === 'CANCELADA') {
    reason = (p.cancellationReason ?? '').trim()
    if (!reason) throw new DeliveryTransitionError('CANCELLATION_REASON_REQUIRED')
    if (reason.length > CANCELLATION_REASON_MAX) reason = reason.slice(0, CANCELLATION_REASON_MAX)
  }

  await hooks.beforeWrite?.()

  // (7) CAS: solo transiciona si el estado sigue siendo el esperado. count 0 → otra ejecución
  //     ganó (p. ej. la compleción) o el cliente estaba obsoleto → se reclasifica y falla cerrado.
  const res = await tx.delivery.updateMany({
    where: { id: p.deliveryId, status: p.expectedCurrentStatus },
    data: {
      status: p.targetStatus,
      ...(p.targetStatus === 'EN_CURSO' ? { startedAt: p.now } : {}),
      ...(p.targetStatus === 'CANCELADA' ? { cancellationReason: reason } : {}),
    },
  })
  if (res.count === 0) {
    const current = await tx.delivery.findUnique({
      where: { id: p.deliveryId },
      select: { status: true },
    })
    if (!current) throw new DeliveryTransitionError('DELIVERY_NOT_FOUND')
    if (current.status === 'CANCELADA')
      throw new DeliveryTransitionError('DELIVERY_ALREADY_CANCELLED')
    if (current.status === 'COMPLETADA')
      throw new DeliveryTransitionError('DELIVERY_ALREADY_COMPLETED')
    throw new DeliveryTransitionError('DELIVERY_STATUS_CHANGED')
  }

  // (8) Traza en la MISMA transacción (atómica con la transición y el motivo).
  if (p.targetStatus === 'CANCELADA') {
    await tx.activity.create({
      data: {
        type: 'ENTREGA_CANCELADA',
        content: `Entrega cancelada. Motivo: ${reason}`,
        agentId: p.actorId,
        sellerLeadId: vehicle.sellerLeadId,
        buyerLeadId: p.buyerLeadId,
      },
    })
  } else {
    // EN_CURSO: CAMBIO_ESTADO SIN flecha "→" para no contaminar el time-in-state de leads
    // (el parser del dashboard solo interpreta "X → Y"). Mismo patrón que completeDeliveryTx.
    await tx.activity.create({
      data: {
        type: 'CAMBIO_ESTADO',
        content: 'Entrega iniciada (en curso).',
        agentId: p.actorId,
        sellerLeadId: vehicle.sellerLeadId,
        buyerLeadId: p.buyerLeadId,
      },
    })
  }

  return { previousStatus: delivery.status, newStatus: p.targetStatus }
}
