/**
 * Carga de dependencias activas para decidir si un lead puede archivarse (PR B2).
 *
 * Solo LECTURA: cuenta operaciones abiertas. No modifica, cancela ni reasigna nada — el
 * operador debe resolver las dependencias explícitamente (decisión de producto).
 *
 * IMPORTANTE: aceptan `PrismaClient` **o** `Prisma.TransactionClient`. Las acciones SIEMPRE les
 * pasan el cliente transaccional, de modo que estas lecturas quedan dentro de la misma
 * transacción `Serializable` que el CAS — no pueden escapar de ella ni abrir otra conexión.
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import { ACTIVE_DELIVERY_STATUSES, ACTIVE_OFFER_STATUSES, TERMINAL_EVENT_STATUSES } from './domain'
import type { ArchiveDependencyInput } from './types'

/** Cliente válido para estas lecturas: el global o el de una transacción en curso. */
export type ArchiveDbClient = PrismaClient | Prisma.TransactionClient

/** Evento de calendario futuro y no terminal, vinculado al lead (o a su vehículo). */
function futureEventWhere(now: Date) {
  return {
    startAt: { gt: now },
    status: { notIn: [...TERMINAL_EVENT_STATUSES] },
  }
}

/**
 * Dependencias de un VENDEDOR: su vehículo y todo lo que cuelga de él (ofertas, entregas),
 * más su propia próxima acción y eventos futuros.
 */
export async function loadSellerArchiveDependencies(
  db: ArchiveDbClient,
  leadId: string,
  now: Date = new Date()
): Promise<ArchiveDependencyInput> {
  const lead = await db.sellerLead.findUnique({
    where: { id: leadId },
    select: {
      nextActionType: true,
      vehicle: { select: { id: true, status: true } },
    },
  })
  if (!lead) {
    return {
      vehicleStatus: null,
      activeOfferCount: 0,
      activeReservationCount: 0,
      activeDeliveryCount: 0,
      hasPendingNextAction: false,
      futureEventCount: 0,
    }
  }

  const vehicleId = lead.vehicle?.id ?? null

  const [activeOfferCount, activeReservationCount, activeDeliveryCount, futureEventCount] =
    await Promise.all([
      vehicleId
        ? db.offer.count({ where: { vehicleId, status: { in: ACTIVE_OFFER_STATUSES } } })
        : Promise.resolve(0),
      vehicleId
        ? db.offer.count({
            where: { vehicleId, status: 'ACEPTADA', depositAmount: { gt: 0 } },
          })
        : Promise.resolve(0),
      vehicleId
        ? db.delivery.count({ where: { vehicleId, status: { in: ACTIVE_DELIVERY_STATUSES } } })
        : Promise.resolve(0),
      db.calendarEvent.count({
        where: {
          ...futureEventWhere(now),
          OR: [{ sellerLeadId: leadId }, ...(vehicleId ? [{ vehicleId }] : [])],
        },
      }),
    ])

  return {
    vehicleStatus: lead.vehicle?.status ?? null,
    activeOfferCount,
    activeReservationCount,
    activeDeliveryCount,
    hasPendingNextAction: lead.nextActionType != null,
    futureEventCount,
  }
}

/** Dependencias de un COMPRADOR: sus ofertas, entregas, próxima acción y eventos futuros. */
export async function loadBuyerArchiveDependencies(
  db: ArchiveDbClient,
  leadId: string,
  now: Date = new Date()
): Promise<ArchiveDependencyInput> {
  const lead = await db.buyerLead.findUnique({
    where: { id: leadId },
    select: { nextActionType: true },
  })
  if (!lead) {
    return {
      vehicleStatus: null,
      activeOfferCount: 0,
      activeReservationCount: 0,
      activeDeliveryCount: 0,
      hasPendingNextAction: false,
      futureEventCount: 0,
    }
  }

  const [activeOfferCount, activeReservationCount, activeDeliveryCount, futureEventCount] =
    await Promise.all([
      db.offer.count({ where: { buyerLeadId: leadId, status: { in: ACTIVE_OFFER_STATUSES } } }),
      db.offer.count({
        where: { buyerLeadId: leadId, status: 'ACEPTADA', depositAmount: { gt: 0 } },
      }),
      db.delivery.count({
        where: { buyerLeadId: leadId, status: { in: ACTIVE_DELIVERY_STATUSES } },
      }),
      db.calendarEvent.count({ where: { ...futureEventWhere(now), buyerLeadId: leadId } }),
    ])

  return {
    // El comprador no tiene vehículo propio: el bloqueo de stock es exclusivo del vendedor.
    vehicleStatus: null,
    activeOfferCount,
    activeReservationCount,
    activeDeliveryCount,
    hasPendingNextAction: lead.nextActionType != null,
    futureEventCount,
  }
}
