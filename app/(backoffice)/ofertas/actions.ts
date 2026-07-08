'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { isValidOfferStatus, isValidOfferTransition, OFFER_STATUS_LABELS } from '@/lib/offers'
import { isValidTransition, VEHICLE_TRANSITIONS } from '@/lib/state-machine'
import { isValidLostReason } from '@/lib/lost-reason'
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
      vehicle: { select: { id: true, status: true, sellerLeadId: true, brand: true, model: true } },
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

  const wasReservation = offer.status === 'ACEPTADA'
  const reservedUntil =
    next === 'ACEPTADA' && extra.reservedUntil ? new Date(extra.reservedUntil) : null
  if (next === 'ACEPTADA' && extra.reservedUntil && isNaN(reservedUntil!.getTime())) {
    return { error: 'Fecha de reserva no válida' }
  }

  // Efecto sobre el vehículo
  const veh = offer.vehicle
  let vehicleStatusChange: 'RESERVADO' | 'PUBLICADO' | null = null
  if (next === 'ACEPTADA' && isValidTransition(VEHICLE_TRANSITIONS, veh.status, 'RESERVADO')) {
    vehicleStatusChange = 'RESERVADO'
  } else if (
    (next === 'CANCELADA' || next === 'RETIRADA' || next === 'EXPIRADA') &&
    wasReservation &&
    isValidTransition(VEHICLE_TRANSITIONS, veh.status, 'PUBLICADO')
  ) {
    vehicleStatusChange = 'PUBLICADO'
  }

  const label = `Oferta ${OFFER_STATUS_LABELS[next].toLowerCase()}`
  const detail =
    next === 'ACEPTADA' && extra.depositAmount
      ? `${label} · señal ${EUR(extra.depositAmount)}`
      : next === 'RECHAZADA' && rejection
        ? `${label} (${rejection})`
        : label

  await db.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id },
      data: {
        status: next,
        rejectionReason: next === 'RECHAZADA' ? rejection : undefined,
        depositAmount: next === 'ACEPTADA' ? (extra.depositAmount ?? undefined) : undefined,
        reservedUntil: next === 'ACEPTADA' ? reservedUntil : undefined,
        amount: extra.finalAmount ?? undefined,
        decidedAt: new Date(),
      },
    })

    if (vehicleStatusChange) {
      await tx.vehicle.update({ where: { id: veh.id }, data: { status: vehicleStatusChange } })
    }

    const content = `${detail} — ${veh.brand} ${veh.model}`
    await tx.activity.create({
      data: {
        type: 'OFERTA_ACTUALIZADA',
        content,
        agentId: actor.id,
        buyerLeadId: offer.buyerLeadId,
      },
    })
    if (veh.sellerLeadId) {
      await tx.activity.create({
        data: {
          type: 'OFERTA_ACTUALIZADA',
          content,
          agentId: actor.id,
          sellerLeadId: veh.sellerLeadId,
        },
      })
    }
  })

  revalidateOffer(offer.buyerLeadId, veh.sellerLeadId)
  revalidatePath('/vendedores')
  return {}
}

/** Block 18: edita importe/notas/señal de una oferta viva. */
export async function updateOffer(
  id: string,
  data: { amount?: number | null; notes?: string | null; depositAmount?: number | null }
): Promise<{ error?: string }> {
  await requireAgente()

  const offer = await db.offer.findUnique({
    where: { id },
    select: { id: true, buyerLeadId: true, vehicle: { select: { sellerLeadId: true } } },
  })
  if (!offer) return { error: 'Oferta no encontrada' }

  if (data.amount != null && data.amount <= 0) return { error: 'Importe no válido' }

  await db.offer.update({
    where: { id },
    data: {
      ...(data.amount != null ? { amount: data.amount } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      ...(data.depositAmount !== undefined ? { depositAmount: data.depositAmount } : {}),
    },
  })

  revalidateOffer(offer.buyerLeadId, offer.vehicle.sellerLeadId)
  return {}
}
