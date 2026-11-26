import { z } from 'zod'
import { db } from '@/lib/db'
import { validSurveySecret, type SurveyLeadKind } from './invitation'

export const surveyExperience = z.enum(['compra', 'venta', 'sin_venta'])
export type SurveyExperience = z.infer<typeof surveyExperience>

export const surveyExperienceLabels: Record<SurveyExperience, string> = {
  compra: 'Compra',
  venta: 'Venta',
  sin_venta: 'Venta no cerrada',
}

const nullableText = z.string().nullable()
const score = z.number().int().min(1).max(5)
const responseSchema = z.object({
  id: z.string().uuid(),
  submittedAt: z.string().datetime(),
  experience: surveyExperience,
  satisfaction: score,
  service: score,
  reason: nullableText,
  otherReason: nullableText,
  comment: nullableText,
  contactName: nullableText,
  contactEmail: nullableText,
  contactPhone: nullableText,
  crmKind: z.enum(['buyer', 'seller']).nullable(),
  crmLeadId: nullableText,
  ratings: z.array(
    z.object({
      label: z.string(),
      value: z.union([score, z.literal('no_aplica'), z.literal('sin_informacion')]).nullable(),
    })
  ),
})
const pageSchema = z.object({ rows: z.array(responseSchema).max(20), nextCursor: nullableText })
export type SurveyResponse = z.infer<typeof responseSchema>
export type SurveyPage = z.infer<typeof pageSchema>

export function surveyCursor(value: unknown): string | undefined {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\|[\da-f-]{36}$/i.test(value)
    ? value
    : undefined
}

export function surveySiteUrl(): URL {
  const url = new URL(process.env.SURVEY_SITE_URL || 'https://encuesta.campersnova.com')
  if (
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        url.hostname === '127.0.0.1' &&
        process.env.NODE_ENV !== 'production'
      )) ||
    url.username ||
    url.password
  ) {
    throw new Error('Invalid survey site URL')
  }
  return new URL('/', url)
}

export async function readSurveyResponses(filter: {
  experience?: SurveyExperience
  cursor?: string
  kind?: SurveyLeadKind
  leadIds?: string[]
}): Promise<SurveyPage | null> {
  const key = process.env.SURVEY_CRM_READ_TOKEN
  if (!validSurveySecret(key)) return null

  try {
    const response = await fetch(new URL('/api/crm/respuestas', surveySiteUrl()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(4500),
      body: JSON.stringify(filter),
    })
    if (!response.ok) {
      console.warn('survey_crm_read_rejected', { status: response.status })
      return null
    }
    return pageSchema.parse(await response.json())
  } catch {
    console.warn('survey_crm_read_unavailable')
    return null
  }
}

export function surveyLeadPath(kind: SurveyLeadKind, leadId: string): string {
  return `/${kind === 'buyer' ? 'compradores' : 'vendedores'}/${encodeURIComponent(leadId)}?tab=encuestas`
}

export type SurveyClient = { name: string; href: string }

export async function resolveSurveyClients(
  rows: SurveyResponse[]
): Promise<Map<string, SurveyClient>> {
  const buyerIds = rows.flatMap((row) =>
    row.crmKind === 'buyer' && row.crmLeadId ? [row.crmLeadId] : []
  )
  const sellerIds = rows.flatMap((row) =>
    row.crmKind === 'seller' && row.crmLeadId ? [row.crmLeadId] : []
  )

  const [buyers, sellers] = await Promise.all([
    buyerIds.length
      ? db.buyerLead.findMany({
          where: { id: { in: buyerIds } },
          select: { id: true, name: true, mergedInto: { select: { id: true, name: true } } },
        })
      : [],
    sellerIds.length
      ? db.sellerLead.findMany({
          where: { id: { in: sellerIds } },
          select: { id: true, name: true },
        })
      : [],
  ])

  const clients = new Map<string, SurveyClient>()
  for (const buyer of buyers) {
    const current = buyer.mergedInto ?? buyer
    clients.set('buyer:' + buyer.id, {
      name: current.name || 'Comprador',
      href: surveyLeadPath('buyer', current.id),
    })
  }
  for (const seller of sellers) {
    clients.set('seller:' + seller.id, {
      name: seller.name || 'Vendedor',
      href: surveyLeadPath('seller', seller.id),
    })
  }
  return clients
}
