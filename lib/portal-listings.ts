import { z } from 'zod'
import { offerDay } from '@/lib/buyer-offers'

export const portalLabels = { WALLAPOP: 'Wallapop', COCHESNET: 'Coches.net' } as const
export type SalePortal = keyof typeof portalLabels
export const salePortals = ['WALLAPOP', 'COCHESNET'] as const
export type PortalListingView = {
  url: string
  publishedOn: string
  withdrawn: boolean
  revision: number
}

const domains: Record<SalePortal, string[]> = {
  WALLAPOP: ['wallapop.com'],
  COCHESNET: ['coches.net'],
}
const channel = z.enum(salePortals)
const revision = z.number().int().nonnegative()
const publicationDate = z
  .string()
  .regex(/^\d{4}-\d\d-\d\d$/)
  .refine((value) => {
    const date = new Date(value + 'T00:00:00Z')
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value <= offerDay(new Date())
    )
  }, 'Indica una fecha de publicación válida, de hoy o anterior.')

export function isPortalUrl(channel: SalePortal, value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname !== '/' &&
      domains[channel].some((host) => url.hostname === host || url.hostname.endsWith('.' + host))
    )
  } catch {
    return false
  }
}
export const listingChange = z
  .discriminatedUnion('action', [
    z.object({
      action: z.literal('publish'),
      channel,
      revision,
      url: z.string().trim().min(1).max(2048),
      publishedOn: publicationDate,
    }),
    z.object({ action: z.literal('withdraw'), channel, revision }),
  ])
  .superRefine((input, ctx) => {
    if (input.action === 'publish' && !isPortalUrl(input.channel, input.url))
      ctx.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'Introduce el enlace HTTPS del anuncio en ' + portalLabels[input.channel] + '.',
      })
  })
