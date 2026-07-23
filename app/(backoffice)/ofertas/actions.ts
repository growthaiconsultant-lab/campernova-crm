'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import {
  isValidDepositAmount,
  isValidOfferStatus,
  isValidOfferTransition,
  OFFER_STATUS_LABELS,
} from '@/lib/offers'
import {
  buildOfferCreationRoots,
  createOfferTx,
  isOfferCreationError,
  OFFER_CREATION_ERROR_MESSAGES,
  type CreateOfferTxResult,
} from '@/lib/offers-creation'
import {
  applyOfferTransitionTx,
  buildOfferTransitionRoots,
  isOfferTransitionError,
  OFFER_TRANSITION_ERROR_MESSAGES,
  type OfferTransitionResult,
} from '@/lib/offers-transition'
import { isLockError, withLockedRoots } from '@/lib/locking'
// El servicio de reserva (CAS de Offer y Vehicle) lo invoca ahora el núcleo de transición, dentro
// de la transacción con las raíces bloqueadas. Aquí solo se necesita su error de conflicto.
import { OfferConflictError } from '@/lib/offers-reservation'
import { isValidLostReason } from '@/lib/lost-reason'
import { emitKpiEvent } from '@/lib/kpi/emit'
import { KPI_EVENTS } from '@/lib/kpi/events'
import type { OfferStatus, LostReason } from '@prisma/client'

type CreateOfferInput = {
  vehicleId: string
  buyerLeadId: string
  matchId?: string | null
  amount: number
  notes?: string | null
}

/** Revalida las fichas de ambos lados + el listado de ofertas. */
function revalidateOffer(buyerLeadId: string, sellerLeadId: string | null) {
  revalidatePath('/ofertas')
  revalidatePath(`/compradores/${buyerLeadId}`)
  if (sellerLeadId) revalidatePath(`/vendedores/${sellerLeadId}`)
}

/**
 * Block 18: registra una oferta de un comprador por un vehículo.
 * Deja traza en el timeline de ambos lados (comprador + vendedor).
 */
export async function createOffer(
  data: CreateOfferInput
): Promise<{ error?: string; id?: string }> {
  const actor = await requireAgente()

  if (!data.vehicleId || !data.buyerLeadId) return { error: 'Falta el vehículo o el comprador' }
  if (!data.amount || data.amount <= 0) return { error: 'Indica un importe válido' }

  // Lectura preliminar: sirve ÚNICAMENTE para descubrir las raíces a bloquear. Ninguna decisión
  // comercial se toma con estos datos — todo se revalida dentro de la transacción.
  const [vehicle, buyer] = await Promise.all([
    db.vehicle.findUnique({
      where: { id: data.vehicleId },
      select: { id: true, sellerLeadId: true },
    }),
    db.buyerLead.findUnique({ where: { id: data.buyerLeadId }, select: { id: true } }),
  ])
  if (!vehicle) return { error: OFFER_CREATION_ERROR_MESSAGES.VEHICLE_NOT_FOUND }
  if (!buyer) return { error: OFFER_CREATION_ERROR_MESSAGES.BUYER_LEAD_NOT_FOUND }

  const roots = buildOfferCreationRoots({
    vehicleId: vehicle.id,
    sellerLeadId: vehicle.sellerLeadId,
    buyerLeadId: buyer.id,
  })

  let created: CreateOfferTxResult
  try {
    created = await withLockedRoots(roots, (tx) =>
      createOfferTx(tx, {
        vehicleId: data.vehicleId,
        buyerLeadId: data.buyerLeadId,
        resolvedSellerLeadId: vehicle.sellerLeadId,
        matchId: data.matchId || null,
        amount: data.amount,
        notes: data.notes?.trim() || null,
        actorId: actor.id,
      })
    )
  } catch (err) {
    // Conflictos de negocio y de coordinación esperados → mensaje seguro para el comercial.
    if (isOfferCreationError(err)) return { error: err.message }
    if (isLockError(err)) return { error: err.message }
    // Cualquier otro error es técnico e inesperado: se propaga para que lo capture Sentry.
    throw err
  }

  // Efectos externos: SIEMPRE después del commit. Dentro del lock alargarían su retención tanto
  // como tarde el servicio externo.
  await emitKpiEvent({
    event: KPI_EVENTS.OFFER_CREATED,
    entityType: 'offer',
    entityId: created.offerId,
    relatedEntityType: 'vehicle',
    relatedEntityId: data.vehicleId,
    actorUserId: actor.id,
    source: 'ui',
    metadata: { amount: data.amount, buyerLeadId: data.buyerLeadId },
  })

  // Se revalida con el vendedor que vio la transacción, no con el de la lectura preliminar.
  revalidateOffer(buyer.id, created.sellerLeadId)
  return { id: created.offerId }
}

type StatusExtra = {
  depositAmount?: number | null // señal (al ACEPTAR = reserva)
  reservedUntil?: string | null // ISO, reserva válida hasta
  rejectionReason?: string | null // al RECHAZAR
  finalAmount?: number | null // importe acordado final (al ACEPTAR/CONVERTIR)
}

/**
 * Block 18: cambia el estado de la oferta con sus efectos:
 * - ACEPTADA (con señal) → reserva; el vehículo pasa a RESERVADO si estaba PUBLICADO.
 * - CANCELADA desde una reserva → libera el vehículo (RESERVADO → PUBLICADO).
 * - CONVERTIDA → marca cerrada como venta (el VENDIDO real vive en Delivery).
 */
export async function updateOfferStatus(
  id: string,
  status: string,
  extra: StatusExtra = {}
): Promise<{ error?: string }> {
  const actor = await requireAgente()
  if (!isValidOfferStatus(status)) return { error: 'Estado no válido' }

  // Lectura preliminar: sirve ÚNICAMENTE para descubrir las raíces a bloquear. La transición se
  // revalida dentro de la transacción sobre datos releídos.
  const offer = await db.offer.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      buyerLeadId: true,
      vehicle: { select: { id: true, sellerLeadId: true } },
    },
  })
  if (!offer) return { error: OFFER_TRANSITION_ERROR_MESSAGES.OFFER_NOT_FOUND }

  const next = status as OfferStatus
  if (!isValidOfferTransition(offer.status, next)) {
    return {
      error: `Transición no permitida: ${OFFER_STATUS_LABELS[offer.status]} → ${OFFER_STATUS_LABELS[next]}`,
    }
  }

  let rejection: LostReason | null = null
  if (next === 'RECHAZADA' && extra.rejectionReason) {
    if (!isValidLostReason(extra.rejectionReason)) return { error: 'Motivo no válido' }
    rejection = extra.rejectionReason
  }

  // Única entrada de señal del dominio (I2A). El formulario acepta texto libre, así que un importe
  // negativo llega hasta aquí; se rechaza antes de escribir nada. `null` y `0` siguen siendo
  // válidos: aceptar sin señal es una operación legítima que igualmente inmoviliza el vehículo.
  if (!isValidDepositAmount(extra.depositAmount)) {
    return { error: 'La señal no puede ser negativa' }
  }

  const reservedUntil =
    next === 'ACEPTADA' && extra.reservedUntil ? new Date(extra.reservedUntil) : null
  if (next === 'ACEPTADA' && extra.reservedUntil && isNaN(reservedUntil!.getTime())) {
    return { error: 'Fecha de reserva no válida' }
  }

  const roots = buildOfferTransitionRoots({
    vehicleId: offer.vehicle.id,
    sellerLeadId: offer.vehicle.sellerLeadId,
    buyerLeadId: offer.buyerLeadId,
  })

  // Locks de raíz + relectura + CAS: los locks coordinan el dominio (archivado, doble aceptación);
  // el CAS conserva su papel de detectar expectativas obsoletas del llamante.
  let result: OfferTransitionResult
  try {
    result = await withLockedRoots(roots, (tx) =>
      applyOfferTransitionTx(tx, {
        offerId: id,
        toStatus: next,
        resolvedVehicleId: offer.vehicle.id,
        resolvedBuyerLeadId: offer.buyerLeadId,
        resolvedSellerLeadId: offer.vehicle.sellerLeadId,
        depositAmount: next === 'ACEPTADA' ? extra.depositAmount : undefined,
        reservedUntil,
        rejectionReason: rejection,
        finalAmount: extra.finalAmount ?? undefined,
        actorId: actor.id,
      })
    )
  } catch (err) {
    // Conflictos de negocio y de coordinación esperados → mensaje seguro para el comercial.
    if (isOfferTransitionError(err)) return { error: err.message }
    if (err instanceof OfferConflictError) return { error: err.message }
    if (isLockError(err)) return { error: err.message }
    // Error técnico inesperado → propágalo (no ocultarlo como "no disponible").
    throw err
  }

  // Eventos KPI de la transición transaccional. Siempre DESPUÉS del commit.
  const wasReservation = result.fromStatus === 'ACEPTADA'
  const kpiEvent =
    next === 'ACEPTADA' && extra.depositAmount
      ? KPI_EVENTS.RESERVATION_CREATED
      : next === 'CANCELADA' || (wasReservation && (next === 'RETIRADA' || next === 'EXPIRADA'))
        ? KPI_EVENTS.RESERVATION_CANCELLED
        : next === 'CONVERTIDA'
          ? KPI_EVENTS.SALE_CLOSED
          : null
  if (kpiEvent) {
    await emitKpiEvent({
      event: kpiEvent,
      entityType: 'offer',
      entityId: id,
      relatedEntityType: 'vehicle',
      relatedEntityId: result.vehicleId,
      actorUserId: actor.id,
      source: 'ui',
      metadata: { amount: result.amount, status: next },
    })
  }

  // Se revalida con los datos que vio la transacción, no con los de la lectura preliminar.
  revalidateOffer(result.buyerLeadId, result.sellerLeadId)
  revalidatePath('/vendedores')
  return {}
}

/*
 * NOTA (I2A): aquí vivía `updateOffer`, una edición genérica de importe, notas y señal.
 *
 * Se retiró porque no tenía ningún consumidor —ni UI, ni otro módulo— y en cambio permitía fijar
 * `depositAmount` en cualquier estado, sin transacción, sin Activity y sin sincronizar el estado
 * del vehículo: es decir, convertir una oferta aceptada en reserva por un camino que el dominio no
 * observaba.
 *
 * La señal se registra exclusivamente al ACEPTAR, dentro de `updateOfferStatus`, que sí es
 * transaccional y deja traza. Si en el futuro hace falta corregir o devolver una señal, será una
 * operación explícita, auditable y coordinada —con su transición, su Activity y su efecto sobre el
 * stock—, no una actualización genérica de campos.
 */
