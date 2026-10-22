import { Prisma, type PrismaClient, type Activity } from '@prisma/client'
import { lockBuyerIdentity, rememberBuyerContact } from './buyer-identity'
import { phonesMatch } from './phone'
import { KPI_EVENTS } from './kpi/events'

export class BuyerMergeError extends Error {}

export function isUnattendedAutomaticSuggestion(match: {
  status: string
  generatedBy: string
  _count: { calendarEvents: number; offers: number }
}) {
  return (
    match.status === 'SUGERIDO' &&
    match.generatedBy === 'auto' &&
    match._count.calendarEvents === 0 &&
    match._count.offers === 0
  )
}

export function firstBuyerHandler(
  activities: Pick<Activity, 'id' | 'type' | 'content' | 'agentId' | 'createdAt'>[]
) {
  return (
    [...activities]
      .filter(
        (a) =>
          a.agentId &&
          (['LLAMADA', 'EMAIL', 'WHATSAPP_INICIADO'].includes(a.type) ||
            (a.type === 'NOTA' &&
              a.content?.trim() &&
              !/^(COM-9:|Origen cambiado:|COM-13:)/.test(a.content)))
      )
      .sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
      )[0] ?? null
  )
}

export async function buyerMergePreview(
  client: PrismaClient | Prisma.TransactionClient,
  ids: string[]
) {
  if (ids.length !== 2 || ids[0] === ids[1])
    throw new BuyerMergeError('Selecciona dos fichas distintas.')
  const rows = await client.buyerLead.findMany({
    where: { id: { in: ids } },
    include: {
      agent: { select: { name: true } },
      warranty: { select: { id: true } },
      _count: {
        select: {
          activities: true,
          chatSessions: true,
          offers: true,
          deliveries: true,
          documents: true,
          operationalDocuments: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  if (rows.length !== 2) throw new BuyerMergeError('No se encuentran las dos fichas.')
  const [target, source] = rows
  const sameEmail =
    !!target.email?.trim() &&
    target.email.trim().toLowerCase() === source.email?.trim().toLowerCase()
  if (!phonesMatch(target.phone, source.phone) && !sameEmail)
    throw new BuyerMergeError('Los contactos no coinciden.')
  const activities = await client.activity.findMany({
    where: { buyerLeadId: { in: ids } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  const first = firstBuyerHandler(activities)
  const responsibleId = first?.agentId ?? target.agentId
  const responsible = responsibleId
    ? await client.user.findUnique({ where: { id: responsibleId } })
    : null
  if (!responsible?.active || !['ADMIN', 'AGENTE'].includes(responsible.role))
    throw new BuyerMergeError('El primer responsable no es un comercial activo. Requiere revisión.')
  return { target, source, responsible, first, activityIds: activities.map((a) => a.id) }
}

export async function mergeBuyerLeads(
  client: PrismaClient,
  input: {
    ids: string[]
    actorId: string
    targetVersion: string
    sourceVersion: string
    responsibleId: string
  }
) {
  return client.$transaction(
    async (tx) => {
      await lockBuyerIdentity(tx)
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'")
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM buyer_leads WHERE id IN (${Prisma.join([...input.ids].sort())}) ORDER BY id FOR UPDATE`
      )
      const p = await buyerMergePreview(tx, input.ids)
      if (p.source.mergedIntoId === p.target.id) return p.target.id
      if (
        p.target.mergedIntoId ||
        p.source.mergedIntoId ||
        p.target.archivedAt ||
        p.source.archivedAt
      )
        throw new BuyerMergeError('Sólo se pueden unificar fichas activas sin fusionar.')
      if (
        p.target.updatedAt.toISOString() !== input.targetVersion ||
        p.source.updatedAt.toISOString() !== input.sourceVersion ||
        p.responsible.id !== input.responsibleId
      )
        throw new BuyerMergeError('Las fichas han cambiado. Revisa de nuevo antes de unificarlas.')
      // Financial and private-document roots need their own operation-specific review.
      for (const row of [p.target, p.source]) {
        if (
          row._count.offers ||
          row._count.deliveries ||
          row.warranty ||
          row._count.documents ||
          row._count.operationalDocuments ||
          row.tradeInSellerLeadId
        )
          throw new BuyerMergeError(
            'Hay contratos, entregas, documentos o parte de pago. Se requiere revisión especializada.'
          )
      }
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM matches WHERE buyer_lead_id IN (${Prisma.join([...input.ids].sort())}) ORDER BY id FOR UPDATE`
      )
      const sourceMatches = await tx.match.findMany({
        where: { buyerLeadId: p.source.id },
        include: { _count: { select: { calendarEvents: true, offers: true } } },
      })
      const targetMatches = await tx.match.findMany({
        where: { buyerLeadId: p.target.id },
        include: { _count: { select: { calendarEvents: true, offers: true } } },
      })
      const overlaps = sourceMatches.filter((m) =>
        targetMatches.some((target) => target.vehicleId === m.vehicleId)
      )
      if (
        overlaps.some((source) => {
          const target = targetMatches.find((m) => m.vehicleId === source.vehicleId)!
          return ![source, target].every(isUnattendedAutomaticSuggestion)
        })
      )
        throw new BuyerMergeError(
          'Ambas fichas tienen vehículos asociados coincidentes. Requiere revisión.'
        )
      // Equivalent automatic suggestions remain on the archived original, preserving scores/IDs.
      const retainedIds = new Set(overlaps.map((m) => m.id))
      const movableMatches = sourceMatches.filter((m) => !retainedIds.has(m.id))
      const moved = await tx.activity.findMany({
        where: { buyerLeadId: p.source.id },
        select: { id: true },
      })
      const chats = await tx.buyerChatSession.findMany({
        where: { buyerLeadId: p.source.id },
        select: { id: true },
      })
      const events = await tx.calendarEvent.findMany({
        where: { buyerLeadId: p.source.id },
        select: { id: true },
      })
      // Keep both original records; fill only unknown preferences on the canonical record.
      const fill: Record<string, unknown> = {}
      const ignored = new Set([
        'id',
        'createdAt',
        'updatedAt',
        'agentId',
        'mergedIntoId',
        'mergedAt',
        'archivedAt',
        'archivedById',
        'archiveReason',
        'archiveNotes',
        'status',
        'source',
        'agent',
        'warranty',
        '_count',
        'nextActionType',
        'nextActionDueAt',
      ])
      for (const [key, value] of Object.entries(p.source)) {
        if (
          !ignored.has(key) &&
          (p.target as Record<string, unknown>)[key] == null &&
          value != null
        )
          fill[key] = value
      }
      await tx.buyerLead.update({
        where: { id: p.target.id },
        data: { ...fill, agentId: p.responsible.id },
      })
      await tx.activity.updateMany({
        where: { buyerLeadId: p.source.id },
        data: { buyerLeadId: p.target.id },
      })
      await tx.buyerChatSession.updateMany({
        where: { buyerLeadId: p.source.id },
        data: { buyerLeadId: p.target.id },
      })
      await tx.match.updateMany({
        where: { buyerLeadId: p.source.id, id: { in: movableMatches.map((m) => m.id) } },
        data: { buyerLeadId: p.target.id },
      })
      await tx.calendarEvent.updateMany({
        where: { buyerLeadId: p.source.id },
        data: { buyerLeadId: p.target.id },
      })
      await tx.calendarEvent.updateMany({
        where: {
          buyerLeadId: p.target.id,
          status: { notIn: ['COMPLETADO', 'CANCELADO', 'NO_SHOW'] },
        },
        data: { assignedToId: p.responsible.id },
      })
      if (p.source.nextActionType && p.source.nextActionDueAt)
        await tx.calendarEvent.create({
          data: {
            id: `buyer_merge_action_${p.source.id}`,
            type: p.source.nextActionType === 'LLAMAR' ? 'LLAMADA' : 'OTRO',
            title: `Seguimiento conservado · ${p.source.nextActionType}`,
            startAt: p.source.nextActionDueAt,
            buyerLeadId: p.target.id,
            assignedToId: p.responsible.id,
            createdById: input.actorId,
          },
        })
      await tx.buyerContact.updateMany({
        where: { buyerLeadId: p.source.id },
        data: { buyerLeadId: p.target.id },
      })
      const now = new Date()
      await tx.buyerLead.update({
        where: { id: p.source.id },
        data: {
          mergedIntoId: p.target.id,
          mergedAt: now,
          archivedAt: now,
          archivedById: input.actorId,
          archiveReason: 'POSIBLE_DUPLICADO',
          archiveNotes: 'COM-13: unificado conservando datos originales e historial.',
          agentId: p.responsible.id,
          nextActionType: null,
          nextActionDueAt: null,
        },
      })
      await tx.buyerLead.updateMany({
        where: { mergedIntoId: p.source.id },
        data: { mergedIntoId: p.target.id },
      })
      await rememberBuyerContact(tx, p.target.id, p.target)
      await rememberBuyerContact(tx, p.target.id, p.source)
      // Internal IDs only: sufficient to reverse the moved links without copying contact details.
      await tx.activity.create({
        data: {
          id: `buyer_merge_${p.source.id}`,
          type: 'NOTA',
          buyerLeadId: p.target.id,
          agentId: input.actorId,
          content: `COM-13: ficha «${p.source.name}» unificada con «${p.target.name}». Responsable: ${p.responsible.name}. Se conservan notas, autores, fechas y conversaciones.`,
        },
      })
      await tx.kpiEvent.create({
        data: {
          id: `buyer_merge_${p.source.id}`,
          eventName: KPI_EVENTS.BUYER_MERGED,
          entityType: 'buyer',
          entityId: p.target.id,
          relatedEntityType: 'buyer',
          relatedEntityId: p.source.id,
          actorUserId: input.actorId,
          source: 'ui',
          metadata: {
            sourceId: p.source.id,
            targetId: p.target.id,
            responsibleId: p.responsible.id,
            sourceAgentId: p.source.agentId,
            targetAgentId: p.target.agentId,
            sourceNextActionType: p.source.nextActionType,
            sourceNextActionDueAt: p.source.nextActionDueAt?.toISOString() ?? null,
            filledFields: Object.keys(fill),
            movedMatchIds: movableMatches.map((m) => m.id),
            retainedSourceMatchIds: overlaps.map((m) => m.id),
            movedActivityIds: moved.map((a) => a.id),
            movedChatIds: chats.map((a) => a.id),
            movedEventIds: events.map((a) => a.id),
          },
        },
      })
      const count = await tx.activity.count({
        where: { id: { in: p.activityIds }, buyerLeadId: p.target.id },
      })
      if (count !== p.activityIds.length)
        throw new BuyerMergeError(
          'La verificación de notas ha fallado; no se aplica ningún cambio.'
        )
      return p.target.id
    },
    { timeout: 30000, maxWait: 15000 }
  )
}
