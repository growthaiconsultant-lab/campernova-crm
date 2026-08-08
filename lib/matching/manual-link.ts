import type { MatchLinkReason, Prisma } from '@prisma/client'
import { MANUAL_MATCH_LINK_REASON_LABELS } from './manual-link-constants'

export type ManualMatchLinkParams = {
  vehicleId: string
  buyerLeadId: string
  resolvedSellerLeadId: string
  actorId: string
  reason: MatchLinkReason
  notes: string | null
  now: Date
}

export type ManualMatchLinkOutcome =
  | { status: 'created' | 'pinned'; matchId: string; sellerLeadId: string }
  | { status: 'already_linked'; matchId: string; sellerLeadId: string }
  | { status: 'not_found' }
  | { status: 'archived' }
  | { status: 'conflict' }

/**
 * Crea o fija una relación comprador–vehículo bajo los root locks adquiridos por el llamante.
 * Match y las dos Activities se escriben en la misma transacción; el retry no duplica auditoría.
 */
export async function createOrPinManualMatch(
  tx: Prisma.TransactionClient,
  params: ManualMatchLinkParams
): Promise<ManualMatchLinkOutcome> {
  const [vehicle, buyer] = await Promise.all([
    tx.vehicle.findUnique({
      where: { id: params.vehicleId },
      select: {
        id: true,
        sellerLeadId: true,
        sellerLead: { select: { archivedAt: true } },
      },
    }),
    tx.buyerLead.findUnique({
      where: { id: params.buyerLeadId },
      select: { id: true, archivedAt: true },
    }),
  ])

  if (!vehicle || !buyer) return { status: 'not_found' }
  if (vehicle.sellerLeadId !== params.resolvedSellerLeadId) return { status: 'conflict' }
  if (vehicle.sellerLead.archivedAt !== null || buyer.archivedAt !== null) {
    return { status: 'archived' }
  }

  const existing = await tx.match.findUnique({
    where: {
      vehicleId_buyerLeadId: {
        vehicleId: params.vehicleId,
        buyerLeadId: params.buyerLeadId,
      },
    },
    select: { id: true, manualLinkedAt: true },
  })

  if (existing?.manualLinkedAt) {
    return {
      status: 'already_linked',
      matchId: existing.id,
      sellerLeadId: vehicle.sellerLeadId,
    }
  }

  let matchId: string
  let status: 'created' | 'pinned'

  if (existing) {
    const updated = await tx.match.updateMany({
      where: { id: existing.id, manualLinkedAt: null },
      data: {
        manualLinkReason: params.reason,
        manualLinkNotes: params.notes,
        manualLinkedAt: params.now,
        manualLinkedById: params.actorId,
      },
    })

    if (updated.count === 0) {
      return {
        status: 'already_linked',
        matchId: existing.id,
        sellerLeadId: vehicle.sellerLeadId,
      }
    }
    matchId = existing.id
    status = 'pinned'
  } else {
    const created = await tx.match.create({
      data: {
        vehicleId: params.vehicleId,
        buyerLeadId: params.buyerLeadId,
        score: null,
        generatedBy: 'manual',
        status: 'SUGERIDO',
        manualLinkReason: params.reason,
        manualLinkNotes: params.notes,
        manualLinkedAt: params.now,
        manualLinkedById: params.actorId,
      },
      select: { id: true },
    })
    matchId = created.id
    status = 'created'
  }

  const content = `Relación comprador–vehículo vinculada manualmente · Motivo: ${MANUAL_MATCH_LINK_REASON_LABELS[params.reason]}`
  await tx.activity.create({
    data: {
      type: 'MATCH_CREADO',
      content,
      agentId: params.actorId,
      sellerLeadId: vehicle.sellerLeadId,
    },
  })
  await tx.activity.create({
    data: {
      type: 'MATCH_CREADO',
      content,
      agentId: params.actorId,
      buyerLeadId: params.buyerLeadId,
    },
  })

  return { status, matchId, sellerLeadId: vehicle.sellerLeadId }
}
