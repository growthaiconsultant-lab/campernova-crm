import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const parameter = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^\u0000-\u001f\u007f]*$/)
export const landingAttributionSchema = z
  .object({
    utm_source: parameter.optional(),
    utm_medium: parameter.optional(),
    utm_campaign: parameter.optional(),
    utm_content: parameter.optional(),
    utm_term: parameter.optional(),
    utm_id: parameter.optional(),
    campaign_id: parameter.optional(),
    adset_id: parameter.optional(),
    ad_id: parameter.optional(),
    placement: parameter.optional(),
  })
  .strict()
export type LandingParameters = z.infer<typeof landingAttributionSchema>
const snapshotSchema = z
  .object({
    version: z.literal(1),
    landing: z.enum(['/vende-tu-camper.html', '/encuentra-tu-camper.html']),
    params: landingAttributionSchema,
  })
  .strict()
export type LandingAttribution = z.infer<typeof snapshotSchema>
const MARKER = '__CN_ATTRIBUTION_V1__'
const LEGACY_HEADER = 'Formulario de campaña: '

function resolved(value: string | undefined): string | undefined {
  return value && !value.includes('{{') && !value.includes('}}') ? value : undefined
}

/** Old clients sent only a display string. New snapshots avoid delimiter ambiguity. */
export function legacyLandingParameters(origin: string): LandingParameters {
  const params: LandingParameters = {}
  for (const part of origin.split(' · ')) {
    const equal = part.indexOf('=')
    if (equal < 1) continue
    const key = part.slice(0, equal) as keyof LandingParameters
    if (!Object.prototype.hasOwnProperty.call(landingAttributionSchema.shape, key)) continue
    const parsed = parameter.safeParse(part.slice(equal + 1))
    if (parsed.success) params[key] = parsed.data
  }
  return params
}

export function landingAttributionLine(
  landing: LandingAttribution['landing'],
  params: LandingParameters | undefined,
  legacyOrigin: string
): string {
  return (
    MARKER +
    JSON.stringify({ version: 1, landing, params: params ?? legacyLandingParameters(legacyOrigin) })
  )
}

export function readLandingAttribution(content: string | null): LandingAttribution | null {
  if (!content) return null
  // Only the first system-written line may define attribution, never free-form answers.
  const first = content.split('\n', 1)[0]
  if (first.startsWith(MARKER)) {
    try {
      const parsed = snapshotSchema.safeParse(JSON.parse(first.slice(MARKER.length)))
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  }
  if (!first.startsWith(LEGACY_HEADER)) return null
  const landing = snapshotSchema.shape.landing.safeParse(first.slice(LEGACY_HEADER.length))
  if (!landing.success) return null
  const origin = content.split('\n').find((line) => line.startsWith('Atribución del formulario: '))
  return {
    version: 1,
    landing: landing.data,
    params: legacyLandingParameters(origin?.slice('Atribución del formulario: '.length) ?? ''),
  }
}

export function attributionFromActivities(
  activities: { content: string | null; agentId?: string | null }[]
): LandingAttribution | null {
  for (const activity of activities) {
    if (activity.agentId != null) continue
    const attribution = readLandingAttribution(activity.content)
    if (attribution) return attribution
  }
  return null
}

/** Paginated lists fetch only the original system capture, not the entire history. */
export const landingCaptureSelection = {
  where: {
    type: 'NOTA',
    agentId: null,
    OR: [{ content: { startsWith: MARKER } }, { content: { startsWith: LEGACY_HEADER } }],
  },
  orderBy: { createdAt: 'asc' },
  take: 1,
  select: { content: true, agentId: true },
} satisfies Prisma.ActivityFindManyArgs

export function landingBuyerSource(params: LandingParameters): 'INSTAGRAM' | 'META' | 'PRO' {
  const source = resolved(params.utm_source)?.toLowerCase()
  if (source === 'instagram' || source === 'ig') return 'INSTAGRAM'
  if (['meta', 'facebook', 'fb', 'messenger', 'audience_network', 'an'].includes(source ?? ''))
    return 'META'
  return 'PRO'
}

export function landingAttributionRows(
  attribution: LandingAttribution
): { label: string; value: string }[] {
  const p = attribution.params
  const source = resolved(p.utm_source)
  const sourceLabels: Record<string, string> = {
    instagram: 'Instagram',
    ig: 'Instagram',
    facebook: 'Facebook (Meta)',
    fb: 'Facebook (Meta)',
    meta: 'Meta',
    messenger: 'Messenger (Meta)',
    an: 'Audience Network (Meta)',
    audience_network: 'Audience Network (Meta)',
  }
  const sourceKey = source?.toLowerCase()
  const sourceLabel =
    sourceKey && Object.prototype.hasOwnProperty.call(sourceLabels, sourceKey)
      ? sourceLabels[sourceKey]
      : undefined
  const rows = [
    {
      label: 'Landing',
      value:
        attribution.landing === '/vende-tu-camper.html' ? 'Vende tu camper' : 'Encuentra tu camper',
    },
    { label: 'Origen del enlace', value: sourceLabel ?? source ?? 'Sin etiquetas de origen' },
  ]
  const fields: [keyof LandingParameters, string][] = [
    ['utm_campaign', 'Campaña'],
    ['utm_medium', 'Medio'],
    ['utm_content', 'Anuncio / contenido'],
    ['utm_term', 'Audiencia / término'],
    ['utm_id', 'ID de campaña UTM'],
    ['campaign_id', 'ID de campaña'],
    ['adset_id', 'ID de conjunto'],
    ['ad_id', 'ID de anuncio'],
    ['placement', 'Ubicación'],
  ]
  for (const [key, label] of fields) {
    const value = resolved(p[key])
    if (value) rows.push({ label, value })
  }
  return rows
}

export function formatLandingActivity(content: string): string {
  if (!content.startsWith(MARKER)) return content
  const attribution = readLandingAttribution(content)
  const rest = content.split('\n').slice(1).join('\n')
  const header = attribution
    ? landingAttributionRows(attribution)
        .map((r) => `${r.label}: ${r.value}`)
        .join('\n')
    : 'Datos de captación no disponibles'
  return [header, rest].filter(Boolean).join('\n')
}
