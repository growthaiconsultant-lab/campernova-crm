import type { Prisma, TicketStatus } from '@prisma/client'
import { isTicketTransitionAllowed, type TicketTransitionKind } from './transitions'

export type TicketTransitionErrorCode =
  | 'TICKET_NOT_FOUND'
  | 'TRANSITION_NOT_ALLOWED'
  | 'CORRECTION_REASON_REQUIRED'
  | 'STATE_CONFLICT'

export class TicketTransitionError extends Error {
  constructor(readonly code: TicketTransitionErrorCode) {
    super(code)
    this.name = 'TicketTransitionError'
  }
}

export const TICKET_TRANSITION_ERROR_MESSAGES: Record<TicketTransitionErrorCode, string> = {
  TICKET_NOT_FOUND: 'Ticket no encontrado.',
  TRANSITION_NOT_ALLOWED: 'La transición de estado no está permitida.',
  CORRECTION_REASON_REQUIRED: 'Indica el motivo de la corrección.',
  STATE_CONFLICT: 'El ticket cambió mientras lo editabas. Recarga la ficha e inténtalo de nuevo.',
}

export function isTicketTransitionError(error: unknown): error is TicketTransitionError {
  return error instanceof TicketTransitionError
}

type TransitionParams = {
  ticketId: string
  expectedCurrentStatus: TicketStatus
  target: TicketStatus
  kind: TicketTransitionKind
  actorId: string
  reason?: string | null
}

export type TicketTransitionResult = {
  changed: boolean
  warrantyId: string
  vehicleId: string
  sellerLeadId: string
  buyerLeadId: string
  previousStatus: TicketStatus
  status: TicketStatus
}

function transitionTimestamps(
  target: TicketStatus,
  now: Date,
  resolvedAt: Date | null
): Prisma.PostventaTicketUpdateManyMutationInput {
  if (target === 'ABIERTO' || target === 'EN_PROGRESO' || target === 'ANULADO') {
    return { status: target, resolvedAt: null, closedAt: null }
  }
  if (target === 'RESUELTO')
    return { status: target, resolvedAt: resolvedAt ?? now, closedAt: null }
  return { status: target, resolvedAt: resolvedAt ?? now, closedAt: now }
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export async function transitionTicketTx(
  tx: Prisma.TransactionClient,
  params: TransitionParams
): Promise<TicketTransitionResult> {
  const ticket = await tx.postventaTicket.findUnique({
    where: { id: params.ticketId },
    select: {
      status: true,
      title: true,
      costReal: true,
      resolvedAt: true,
      warranty: {
        select: {
          id: true,
          vehicleId: true,
          buyerLeadId: true,
          vehicle: { select: { sellerLeadId: true } },
        },
      },
      cost: { select: { amount: true } },
    },
  })
  if (!ticket) throw new TicketTransitionError('TICKET_NOT_FOUND')

  if (ticket.status === params.target) {
    return {
      changed: false,
      warrantyId: ticket.warranty.id,
      vehicleId: ticket.warranty.vehicleId,
      sellerLeadId: ticket.warranty.vehicle.sellerLeadId,
      buyerLeadId: ticket.warranty.buyerLeadId,
      previousStatus: ticket.status,
      status: ticket.status,
    }
  }

  if (ticket.status !== params.expectedCurrentStatus) {
    throw new TicketTransitionError('STATE_CONFLICT')
  }

  if (!isTicketTransitionAllowed(ticket.status, params.target, params.kind)) {
    throw new TicketTransitionError('TRANSITION_NOT_ALLOWED')
  }
  const reason = params.reason?.trim() ?? ''
  if (params.kind !== 'forward' && reason.length === 0) {
    throw new TicketTransitionError('CORRECTION_REASON_REQUIRED')
  }

  const now = new Date()
  const cas = await tx.postventaTicket.updateMany({
    where: { id: params.ticketId, status: ticket.status },
    data: transitionTimestamps(params.target, now, ticket.resolvedAt),
  })
  if (cas.count !== 1) throw new TicketTransitionError('STATE_CONFLICT')

  const previousPostedCost = ticket.cost ? Number(ticket.cost.amount) : 0
  let nextPostedCost = previousPostedCost
  if (params.target === 'CERRADO') {
    nextPostedCost = ticket.costReal ? Number(ticket.costReal) : 0
    if (nextPostedCost > 0) {
      await tx.vehicleCost.upsert({
        where: { postventaTicketId: params.ticketId },
        create: {
          vehicleId: ticket.warranty.vehicleId,
          category: 'POSTVENTA',
          description: `Postventa: ${ticket.title}`,
          amount: nextPostedCost,
          createdById: params.actorId,
          postventaTicketId: params.ticketId,
        },
        update: {
          description: `Postventa: ${ticket.title}`,
          amount: nextPostedCost,
          createdById: params.actorId,
        },
      })
    } else {
      await tx.vehicleCost.deleteMany({ where: { postventaTicketId: params.ticketId } })
    }
  }

  const activityType =
    params.target === 'RESUELTO'
      ? 'TICKET_POSTVENTA_RESUELTO'
      : params.target === 'CERRADO'
        ? 'TICKET_POSTVENTA_CERRADO'
        : 'CAMBIO_ESTADO'
  const actionLabel =
    params.kind === 'forward'
      ? 'Ticket'
      : params.kind === 'correction'
        ? 'Corrección de ticket'
        : 'Reapertura de ticket'
  const costDetail =
    params.target === 'CERRADO'
      ? ` · Coste contabilizado: ${formatMoney(previousPostedCost)} → ${formatMoney(nextPostedCost)}`
      : ''

  await tx.activity.create({
    data: {
      type: activityType,
      content: `${actionLabel}: ${ticket.status} → ${params.target}${reason ? ` · Motivo: ${reason}` : ''}${costDetail}`,
      agentId: params.actorId,
      buyerLeadId: ticket.warranty.buyerLeadId,
    },
  })

  return {
    changed: true,
    warrantyId: ticket.warranty.id,
    vehicleId: ticket.warranty.vehicleId,
    sellerLeadId: ticket.warranty.vehicle.sellerLeadId,
    buyerLeadId: ticket.warranty.buyerLeadId,
    previousStatus: ticket.status,
    status: params.target,
  }
}
