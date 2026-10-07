import { z } from 'zod'
import type { PrismaClient, Prisma } from '@prisma/client'
import { withLockedRoots } from '@/lib/locking/with-locked-roots'
import {
  eligibleBuyerWhere,
  eligibleVehicleWhere,
  isBuyerEligible,
  isVehicleEligible,
} from '@/lib/matching/eligibility'
import { prismaMatchingDeps } from '@/lib/matching/prisma-deps'
import { scorePair } from '@/lib/matching/find'
import { personLabel, vehicleLabel } from '@/lib/display'

const id = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/)
export const manualMatchSchema = z.object({ vehicleId: id, buyerLeadId: id }).strict()
export const manualMatchSearchSchema = z
  .object({
    side: z.enum(['buyer', 'vehicle']),
    fixedId: id,
    query: z.string().trim().max(100).default(''),
    page: z.number().int().min(0).max(1000).default(0),
  })
  .strict()
export type ManualMatchInput = z.infer<typeof manualMatchSchema>
export type ManualMatchSearchInput = z.infer<typeof manualMatchSearchSchema>
export type AssociationCandidate = {
  id: string
  label: string
  detail: string
  associated: boolean
}
export class ManualMatchError extends Error {}

export async function associateManualMatch(
  client: PrismaClient,
  actorId: string,
  input: ManualMatchInput
) {
  const vehicleRoot = await client.vehicle.findUnique({
    where: { id: input.vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicleRoot) throw new ManualMatchError('El vehículo ya no existe. Busca de nuevo.')
  return withLockedRoots(
    [
      { type: 'vehicle', id: input.vehicleId },
      { type: 'sellerLead', id: vehicleRoot.sellerLeadId },
      { type: 'buyerLead', id: input.buyerLeadId },
    ],
    async (tx) => {
      const lockedVehicle = await tx.vehicle.findUnique({
        where: { id: input.vehicleId },
        select: { sellerLeadId: true },
      })
      if (lockedVehicle?.sellerLeadId !== vehicleRoot.sellerLeadId)
        throw new ManualMatchError(
          'La ficha del vehículo ha cambiado. Actualiza y vuelve a seleccionarlo.'
        )
      const deps = prismaMatchingDeps(tx)
      const [vehicle, buyer] = await Promise.all([
        deps.getVehicle(input.vehicleId),
        deps.getBuyer(input.buyerLeadId),
      ])
      if (
        !buyer ||
        !isBuyerEligible({ status: buyer.status!, archivedAt: buyer.archivedAt ?? null })
      ) {
        throw new ManualMatchError(
          'El comprador está cerrado, perdido o archivado. No admite nuevos intereses.'
        )
      }
      if (
        !vehicle ||
        !isVehicleEligible({
          status: vehicle.status!,
          sellerArchivedAt: vehicle.sellerArchivedAt ?? null,
          entryValidatedAt: vehicle.entryValidatedAt ?? null,
          entryAnnulledAt: vehicle.entryAnnulledAt ?? null,
        })
      ) {
        throw new ManualMatchError(
          'El vehículo ya no está disponible para nuevos intereses. Debe estar tasado o publicado, con entrada validada y vendedor activo.'
        )
      }
      const where = { vehicleId_buyerLeadId: input }
      const previous = await tx.match.findUnique({
        where,
        select: { generatedBy: true, score: true },
      })
      if (previous?.generatedBy === 'manual')
        return { saved: false, sellerLeadId: vehicleRoot.sellerLeadId }
      // El upsert conserva el estado de una sugerencia/oferta/rechazo existente.
      await tx.match.upsert({
        where,
        create: {
          ...input,
          generatedBy: 'manual',
          status: 'SUGERIDO',
          score: previous?.score ?? scorePair(vehicle, buyer).score,
        },
        update: { generatedBy: 'manual' },
      })
      const activity = {
        type: 'MATCH_CREADO' as const,
        content: 'Interés asociado manualmente entre comprador y vehículo.',
        agentId: actorId,
      }
      await tx.activity.createMany({
        data: [
          { ...activity, sellerLeadId: vehicleRoot.sellerLeadId },
          { ...activity, buyerLeadId: input.buyerLeadId },
        ],
      })
      return { saved: true, sellerLeadId: vehicleRoot.sellerLeadId }
    },
    { client }
  )
}

const PAGE_SIZE = 6
type SearchClient = Pick<PrismaClient, 'vehicle' | 'buyerLead'>
export async function searchManualMatchCandidates(
  client: SearchClient,
  input: ManualMatchSearchInput
) {
  const { side, fixedId, query, page } = input
  const take = PAGE_SIZE + 1
  const skip = page * PAGE_SIZE
  const terms = query.split(/\s+/).filter(Boolean)
  let items: AssociationCandidate[]
  if (side === 'buyer') {
    const fixed = await client.buyerLead.findFirst({
      where: { ...eligibleBuyerWhere, id: fixedId },
      select: { id: true },
    })
    if (!fixed) throw new ManualMatchError('Este comprador no admite nuevos intereses.')
    const search: Prisma.VehicleWhereInput = terms.length
      ? {
          AND: terms.map((term) => ({
            OR: [
              { plate: { contains: term, mode: 'insensitive' } },
              { brand: { contains: term, mode: 'insensitive' } },
              { model: { contains: term, mode: 'insensitive' } },
            ],
          })),
        }
      : {}
    const rows = await client.vehicle.findMany({
      where: { ...eligibleVehicleWhere, ...search },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }, { id: 'asc' }],
      take,
      skip,
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        plate: true,
        matches: { where: { buyerLeadId: fixedId, generatedBy: 'manual' }, select: { id: true } },
      },
    })
    items = rows.map((row) => ({
      id: row.id,
      label: vehicleLabel(row),
      detail: `${row.plate?.trim() || 'Sin matrícula'} · #${row.id.slice(-8)}`,
      associated: row.matches.length > 0,
    }))
  } else {
    const fixed = await client.vehicle.findFirst({
      where: { ...eligibleVehicleWhere, id: fixedId },
      select: { id: true },
    })
    if (!fixed) throw new ManualMatchError('Este vehículo no admite nuevos intereses.')
    const rows = await client.buyerLead.findMany({
      where: {
        ...eligibleBuyerWhere,
        ...(terms.length
          ? {
              AND: terms.map((term) => ({
                name: { contains: term, mode: 'insensitive' as const },
              })),
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take,
      skip,
      select: {
        id: true,
        name: true,
        vehicleType: true,
        minSeats: true,
        matches: { where: { vehicleId: fixedId, generatedBy: 'manual' }, select: { id: true } },
      },
    })
    items = rows.map((row) => ({
      id: row.id,
      label: personLabel(row.name, { role: 'Comprador sin identificar', id: row.id }),
      detail: `${row.vehicleType === 'CAMPER' ? 'Camper' : row.vehicleType === 'AUTOCARAVANA' ? 'Autocaravana' : 'Cualquier tipo'}${row.minSeats ? ` · ${row.minSeats}+ plazas` : ''} · #${row.id.slice(-8)}`,
      associated: row.matches.length > 0,
    }))
  }
  return { items: items.slice(0, PAGE_SIZE), hasMore: items.length > PAGE_SIZE }
}
