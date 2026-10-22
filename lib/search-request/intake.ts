import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { defaultNextActionData } from '@/lib/next-action'
import { KPI_EVENTS } from '@/lib/kpi/events'
import { LandingRateLimitError } from '@/lib/landing/seller-intake'
import { QUESTION_SECTIONS } from './questions'
import type { SearchRequestInput } from './schema'
import {
  lockBuyerIdentity,
  findBuyerIdentity,
  rememberBuyerContact,
  recordBuyerCapture,
  BUYER_CAPTURE_EVENT,
} from '@/lib/buyer-identity'

export class SearchRequestConflict extends Error {}
export function searchRequestId(requestId: string) {
  return 'search_request_' + createHash('sha256').update(requestId).digest('hex').slice(0, 40)
}
export const searchSnapshotId = (leadId: string) => `search_answers_${leadId}`

export function searchRequestSummary(input: SearchRequestInput) {
  return [
    'FICHA DE BÚSQUEDA WEB · /busqueda-bajo-pedido',
    `Versión ${input.version}. Solicitud de contacto; no constituye un encargo firmado.`,
    'Acepta el tratamiento de los datos para atender la solicitud conforme a /privacidad.',
    ...QUESTION_SECTIONS.flatMap((section) => [
      '',
      section.title.toUpperCase(),
      ...section.questions.map((q) => {
        const value = input.answers[q.key]
        return `${q.label}: ${Array.isArray(value) ? value.join(' · ') || 'Sin indicar' : value || 'Sin indicar'}`
      }),
    ]),
  ].join('\n')
}

export async function saveSearchRequest(
  client: PrismaClient,
  input: SearchRequestInput,
  ip: string | null,
  now = new Date()
) {
  const id = searchRequestId(input.requestId)
  const content = searchRequestSummary(input)
  await client.$transaction(
    async (tx) => {
      await lockBuyerIdentity(tx)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`
      const existing = await tx.activity.findUnique({
        where: { id: searchSnapshotId(id) },
        select: { content: true },
      })
      if (existing) {
        if (existing.content !== content) throw new SearchRequestConflict()
        return
      }
      // A missing edge IP still has a shared bounded bucket; never disable the quota.
      const quota = `search-request:ip:${ip ?? 'unknown'}`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${quota}, 0))`
      const ipHash = createHash('sha256')
        .update(ip ?? 'unknown')
        .digest('hex')
      const recent =
        (await tx.buyerLead.count({
          where: {
            id: { startsWith: 'search_request_' },
            gdprConsentIp: ip,
            createdAt: { gte: new Date(now.getTime() - 3600000) },
          },
        })) +
        (await tx.kpiEvent.count({
          where: {
            eventName: BUYER_CAPTURE_EVENT,
            metadata: { path: ['ipHash'], equals: ipHash },
            createdAt: { gte: new Date(now.getTime() - 3600000) },
          },
        }))
      if (recent >= 10) throw new LandingRateLimitError()
      const a = input.answers
      const existingBuyer = await findBuyerIdentity(tx, {
        phone: String(a.phone),
        email: a.email ? String(a.email) : null,
      })
      const leadId = existingBuyer?.id ?? id
      const number = (key: string) => (a[key] ? Number(a[key]) : null)
      if (!existingBuyer)
        await tx.buyerLead.create({
          data: {
            id,
            name: String(a.name),
            phone: String(a.phone),
            email: a.email ? String(a.email) : null,
            status: 'NUEVO',
            source: 'WEB',
            agentId: null, // COM-9 trigger owns the rotation.
            gdprConsentAt: now,
            gdprConsentIp: ip,
            vehicleType:
              a.vehicle === 'Camper'
                ? 'CAMPER'
                : a.vehicle === 'Autocaravana'
                  ? 'AUTOCARAVANA'
                  : null,
            minSeats: number('seats'),
            sleepingPlacesRequired: number('sleeping'),
            maxLengthM: number('maxLength'),
            bathroomRequired:
              a.bathroom === 'Interior imprescindible'
                ? true
                : a.bathroom === 'Puedo prescindir de él'
                  ? false
                  : null,
            financingNeeded:
              a.finance === 'La necesito' ? true : a.finance === 'No la necesito' ? false : null,
            hasTradeIn: a.tradeIn === 'Sí' ? true : a.tradeIn === 'No' ? false : null,
            tradeInNotes: a.tradeInDetails ? String(a.tradeInDetails) : null,
            hasKids: a.children ? Number(a.children) > 0 : null,
            ...defaultNextActionData(now),
            activities: { create: { id: searchSnapshotId(id), type: 'NOTA', content } },
          },
        })
      if (existingBuyer)
        await tx.activity.create({
          data: {
            id: searchSnapshotId(id),
            buyerLeadId: leadId,
            type: 'NOTA',
            content,
          },
        })
      await rememberBuyerContact(tx, leadId, {
        phone: String(a.phone),
        email: a.email ? String(a.email) : null,
      })
      if (existingBuyer)
        await recordBuyerCapture(tx, { id, leadId, channel: 'search_request', ipHash, now })
      if (!existingBuyer)
        await tx.kpiEvent.create({
          data: {
            eventName: KPI_EVENTS.BUYER_CREATED,
            entityType: 'buyer',
            entityId: id,
            source: 'system',
            metadata: { campaign: 'busqueda-bajo-pedido', buyerSource: 'WEB' },
          },
        })
    },
    { maxWait: 5000, timeout: 10000 }
  )
}
