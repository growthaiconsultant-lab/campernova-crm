'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { isLockError, withLockedRoots, type LockRoot } from '@/lib/locking'
import { createOrPinManualMatch } from '@/lib/matching/manual-link'
import {
  MANUAL_MATCH_LINK_NOTES_MAX_LENGTH,
  MANUAL_MATCH_LINK_REASONS,
} from '@/lib/matching/manual-link-constants'
import type { MatchStatus } from '@prisma/client'

const MATCH_STATUSES: MatchStatus[] = [
  'SUGERIDO',
  'PROPUESTO_CLIENTE',
  'VISITA',
  'OFERTA',
  'CERRADO',
  'RECHAZADO',
]

const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  SUGERIDO: 'Sugerido',
  PROPUESTO_CLIENTE: 'Propuesto al cliente',
  VISITA: 'Visita',
  OFERTA: 'Oferta',
  CERRADO: 'Cerrado',
  RECHAZADO: 'Rechazado',
}

const entityIdSchema = z.string().trim().min(1).max(128)
const candidateSearchSchema = z.object({
  fixedId: entityIdSchema,
  query: z.string().trim().min(2).max(80),
})
const createManualMatchSchema = z.object({
  vehicleId: entityIdSchema,
  buyerLeadId: entityIdSchema,
  reason: z.enum(MANUAL_MATCH_LINK_REASONS),
  notes: z
    .string()
    .trim()
    .max(MANUAL_MATCH_LINK_NOTES_MAX_LENGTH)
    .optional()
    .transform((value) => value || null),
})

export type MatchCandidate = {
  id: string
  label: string
  description: string | null
  hasAutomaticMatch: boolean
}

function rootsFor(vehicleId: string, sellerLeadId: string, buyerLeadId: string): LockRoot[] {
  return [
    { type: 'vehicle', id: vehicleId },
    { type: 'sellerLead', id: sellerLeadId },
    { type: 'buyerLead', id: buyerLeadId },
  ]
}

function safeErrorContext(error: unknown) {
  return { errorType: error instanceof Error ? error.name : typeof error }
}

export async function searchBuyerCandidates(input: {
  fixedId: string
  query: string
}): Promise<{ candidates?: MatchCandidate[]; error?: string }> {
  await requireAgente()
  const parsed = candidateSearchSchema.safeParse(input)
  if (!parsed.success) return { error: 'Escribe al menos dos caracteres.' }

  const buyers = await db.buyerLead.findMany({
    where: {
      archivedAt: null,
      name: { contains: parsed.data.query, mode: 'insensitive' },
      matches: {
        none: { vehicleId: parsed.data.fixedId, manualLinkedAt: { not: null } },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      matches: {
        where: { vehicleId: parsed.data.fixedId },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })

  return {
    candidates: buyers.map((buyer) => ({
      id: buyer.id,
      label: buyer.name || 'Comprador sin identificar',
      description: [buyer.phone, buyer.status].filter(Boolean).join(' · ') || null,
      hasAutomaticMatch: buyer.matches.length > 0,
    })),
  }
}

export async function searchVehicleCandidates(input: {
  fixedId: string
  query: string
}): Promise<{ candidates?: MatchCandidate[]; error?: string }> {
  await requireAgente()
  const parsed = candidateSearchSchema.safeParse(input)
  if (!parsed.success) return { error: 'Escribe al menos dos caracteres.' }

  const q = parsed.data.query
  const vehicles = await db.vehicle.findMany({
    where: {
      sellerLead: { archivedAt: null },
      OR: [
        { brand: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { plate: { contains: q, mode: 'insensitive' } },
        { sellerLead: { name: { contains: q, mode: 'insensitive' } } },
      ],
      matches: {
        none: { buyerLeadId: parsed.data.fixedId, manualLinkedAt: { not: null } },
      },
    },
    select: {
      id: true,
      brand: true,
      model: true,
      plate: true,
      status: true,
      sellerLead: { select: { id: true, name: true } },
      matches: {
        where: { buyerLeadId: parsed.data.fixedId },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })

  return {
    candidates: vehicles.map((vehicle) => ({
      id: vehicle.id,
      label:
        [vehicle.brand, vehicle.model].filter(Boolean).join(' ') ||
        vehicle.plate ||
        'Vehículo sin identificar',
      description:
        [vehicle.plate, vehicle.sellerLead.name, vehicle.status].filter(Boolean).join(' · ') ||
        null,
      hasAutomaticMatch: vehicle.matches.length > 0,
    })),
  }
}

export async function createManualMatch(input: unknown) {
  const actor = await requireAgente()
  const parsed = createManualMatchSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: 'Revisa el comprador, el vehículo y el motivo.' }
  }

  const preliminaryVehicle = await db.vehicle.findUnique({
    where: { id: parsed.data.vehicleId },
    select: { sellerLeadId: true },
  })
  if (!preliminaryVehicle) return { ok: false as const, error: 'Vehículo no encontrado.' }

  try {
    const outcome = await withLockedRoots(
      rootsFor(parsed.data.vehicleId, preliminaryVehicle.sellerLeadId, parsed.data.buyerLeadId),
      (tx) =>
        createOrPinManualMatch(tx, {
          ...parsed.data,
          resolvedSellerLeadId: preliminaryVehicle.sellerLeadId,
          actorId: actor.id,
          now: new Date(),
        })
    )

    if (outcome.status === 'not_found') {
      return { ok: false as const, error: 'Comprador o vehículo no encontrado.' }
    }
    if (outcome.status === 'archived') {
      return {
        ok: false as const,
        error: 'No se puede crear una relación nueva con un registro archivado.',
      }
    }
    if (outcome.status === 'conflict') {
      return {
        ok: false as const,
        error: 'El vehículo ha cambiado. Recarga la ficha e inténtalo de nuevo.',
      }
    }

    revalidatePath(`/vendedores/${outcome.sellerLeadId}`)
    revalidatePath(`/compradores/${parsed.data.buyerLeadId}`)
    return {
      ok: true as const,
      status: outcome.status,
      message:
        outcome.status === 'already_linked'
          ? 'La relación ya estaba vinculada.'
          : 'Relación vinculada correctamente.',
    }
  } catch (error) {
    if (isLockError(error)) return { ok: false as const, error: error.message }
    console.error('[matches] No se pudo crear la relación manual', safeErrorContext(error))
    return { ok: false as const, error: 'No se ha podido vincular. Inténtalo de nuevo.' }
  }
}

export async function updateMatchStatus(matchId: string, newStatus: MatchStatus) {
  const actor = await requireAgente()
  const parsedId = entityIdSchema.safeParse(matchId)
  if (!parsedId.success || !MATCH_STATUSES.includes(newStatus)) {
    return { error: 'Estado de match no válido' }
  }

  const preliminaryMatch = await db.match.findUnique({
    where: { id: parsedId.data },
    select: {
      vehicleId: true,
      buyerLeadId: true,
      vehicle: { select: { sellerLeadId: true } },
    },
  })
  if (!preliminaryMatch) return { error: 'Match no encontrado' }

  try {
    const outcome = await withLockedRoots(
      rootsFor(
        preliminaryMatch.vehicleId,
        preliminaryMatch.vehicle.sellerLeadId,
        preliminaryMatch.buyerLeadId
      ),
      async (tx) => {
        const match = await tx.match.findUnique({
          where: { id: parsedId.data },
          select: {
            status: true,
            vehicleId: true,
            buyerLeadId: true,
            vehicle: { select: { sellerLeadId: true } },
          },
        })
        if (!match) return { status: 'not_found' as const }
        if (match.vehicle.sellerLeadId !== preliminaryMatch.vehicle.sellerLeadId) {
          return { status: 'conflict' as const }
        }
        if (newStatus === match.status) {
          return { status: 'unchanged' as const, match }
        }

        if (newStatus === 'CERRADO') {
          const delivery = await tx.delivery.findFirst({
            where: {
              vehicleId: match.vehicleId,
              buyerLeadId: match.buyerLeadId,
              status: 'COMPLETADA',
            },
            select: { id: true },
          })
          if (!delivery) return { status: 'delivery_required' as const }
        }

        const updated = await tx.match.updateMany({
          where: { id: parsedId.data, status: match.status },
          data: { status: newStatus },
        })
        if (updated.count === 0) return { status: 'conflict' as const }

        const content = `Match: ${MATCH_STATUS_LABELS[match.status]} → ${MATCH_STATUS_LABELS[newStatus]}`
        await tx.activity.create({
          data: {
            type: 'CAMBIO_ESTADO',
            content,
            agentId: actor.id,
            sellerLeadId: match.vehicle.sellerLeadId,
          },
        })
        await tx.activity.create({
          data: {
            type: 'CAMBIO_ESTADO',
            content,
            agentId: actor.id,
            buyerLeadId: match.buyerLeadId,
          },
        })

        return { status: 'updated' as const, match }
      }
    )

    if (outcome.status === 'not_found') return { error: 'Match no encontrado' }
    if (outcome.status === 'delivery_required') {
      return {
        error: 'El match no puede cerrarse sin una entrega completada de esta misma pareja.',
      }
    }
    if (outcome.status === 'conflict') {
      return { error: 'La relación ha cambiado. Recarga la ficha e inténtalo de nuevo.' }
    }

    revalidatePath(`/vendedores/${outcome.match.vehicle.sellerLeadId}`)
    revalidatePath(`/compradores/${outcome.match.buyerLeadId}`)
    return { ok: true }
  } catch (error) {
    if (isLockError(error)) return { error: error.message }
    console.error('[matches] No se pudo cambiar el estado', safeErrorContext(error))
    return { error: 'No se ha podido cambiar el estado. Inténtalo de nuevo.' }
  }
}
