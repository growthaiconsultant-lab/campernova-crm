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
  applyOfferStatusChangeTx,
  OfferConflictError,
  shouldReserveVehicle,
  shouldReleaseVehicle,
} from '@/lib/offers-reservation'
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

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

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

  const [vehicle, buyer] = await Promise.all([
    db.vehicle.findUnique({
      where: { id: data.vehicleId },
      select: { id: true, brand: true, model: true, sellerLeadId: true },
    }),
    db.buyerLead.findUnique({ where: { id: data.buyerLeadId }, select: { id: true, name: true } }),
  ])
  if (!vehicle) return { error: 'Vehículo no encontrado' }
  if (!buyer) return { error: 'Comprador no encontrado' }

  const offer = await db.offer.create({
    data: {
      vehicleId: data.vehicleId,
      buyerLeadId: data.buyerLeadId,
      matchId: data.matchId || null,
      amount: data.amount,
      notes: data.notes?.trim() || null,
      createdById: actor.id,
    },
  })

  const content = `Oferta registrada: ${EUR(data.amount)} — ${buyer.name} por ${vehicle.brand} ${vehicle.model}`
  await db.activity.createMany({
    data: [
      { type: 'OFERTA_REGISTRADA', content, agentId: actor.id, buyerLeadId: buyer.id },
      ...(vehicle.sellerLeadId
        ? [
            {
              type: 'OFERTA_REGISTRADA' as const,
              content,
              agentId: actor.id,
              sellerLeadId: vehicle.sellerLeadId,
            },
          ]
        : []),
    ],
  })

  await emitKpiEvent({
    event: KPI_EVENTS.OFFER_CREATED,
    entityType: 'offer',
    entityId: offer.id,
    relatedEntityType: 'vehicle',
    relatedEntityId: data.vehicleId,
    actorUserId: actor.id,
    source: 'ui',
    metadata: { amount: data.amount, buyerLeadId: data.buyerLeadId },
  })

  revalidateOffer(buyer.id, vehicle.sellerLeadId)
  return { id: offer.id }
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

  const offer = await db.offer.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      amount: true,
      buyerLeadId: true,
      vehicle: { select: { id: true, sellerLeadId: true, brand: true, model: true } },
    },
  })
  if (!offer) return { error: 'Oferta no encontrada' }

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

  const wasReservation = offer.status === 'ACEPTADA'
  const reservedUntil =
    next === 'ACEPTADA' && extra.reservedUntil ? new Date(extra.reservedUntil) : null
  if (next === 'ACEPTADA' && extra.reservedUntil && isNaN(reservedUntil!.getTime())) {
    return { error: 'Fecha de reserva no válida' }
  }

  const veh = offer.vehicle
  const reserve = shouldReserveVehicle(next)
  const release = shouldReleaseVehicle(offer.status, next)

  const label = `Oferta ${OFFER_STATUS_LABELS[next].toLowerCase()}`
  const detail =
    next === 'ACEPTADA' && extra.depositAmount
      ? `${label} · señal ${EUR(extra.depositAmount)}`
      : next === 'RECHAZADA' && rejection
        ? `${label} (${rejection})`
        : label
  const content = `${detail} — ${veh.brand} ${veh.model}`

  // Aceptación/liberación atómica: la disponibilidad se decide con compare-and-swap
  // dentro de la transacción, no con una lectura previa (evita la carrera de doble reserva).
  try {
    await db.$transaction((tx) =>
      applyOfferStatusChangeTx(tx, {
        offerId: id,
        fromStatus: offer.status,
        toStatus: next,
        offerData: {
          rejectionReason: next === 'RECHAZADA' ? (rejection ?? undefined) : undefined,
          depositAmount: next === 'ACEPTADA' ? (extra.depositAmount ?? undefined) : undefined,
          reservedUntil: next === 'ACEPTADA' ? reservedUntil : undefined,
          amount: extra.finalAmount ?? undefined,
        },
        vehicleId: veh.id,
        reserve,
        release,
        activityContent: content,
        actorId: actor.id,
        buyerLeadId: offer.buyerLeadId,
        sellerLeadId: veh.sellerLeadId,
      })
    )
  } catch (err) {
    // Conflicto de negocio esperado por concurrencia → mensaje claro al usuario.
    if (err instanceof OfferConflictError) return { error: err.message }
    // Error técnico inesperado → propágalo (no ocultarlo como "no disponible").
    throw err
  }

  // Eventos KPI de la transición transaccional
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
      entityId: offer.id,
      relatedEntityType: 'vehicle',
      relatedEntityId: veh.id,
      actorUserId: actor.id,
      source: 'ui',
      metadata: { amount: Number(offer.amount), status: next },
    })
  }

  revalidateOffer(offer.buyerLeadId, veh.sellerLeadId)
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
