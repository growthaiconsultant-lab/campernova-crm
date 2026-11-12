import type { OwnerQuoteStatus } from '@prisma/client'
import { z } from 'zod'

const itemInput = z.object({
  itemId: z.string().cuid(),
  description: z.string().trim().max(500),
  cents: z.number().int().min(0).max(999999999).nullable(),
})
export const draftInput = z.object({
  version: z.number().int().nonnegative(),
  revision: z.number().int().nonnegative(),
  lines: z.array(itemInput).min(1).max(500),
})
export const quoteLines = z.array(itemInput.extend({ item: z.string() }))
export type QuoteLine = z.infer<typeof quoteLines>[number]
export function quoteTotal(lines: QuoteLine[]) {
  return lines.reduce((sum, line) => sum + (line.cents ?? 0), 0)
}
export function euro(cents: number) {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}
export const quoteLabels: Record<OwnerQuoteStatus, string> = {
  BORRADOR: 'Borrador',
  EN_ENVIO: 'Envío por confirmar',
  PENDIENTE: 'Pendiente de respuesta',
  ACEPTADO: 'Aceptado',
  RECHAZADO: 'Rechazado',
  SUSTITUIDO: 'Sustituido',
}
export type QuoteView = {
  version: number
  revision: number
  status: OwnerQuoteStatus
  lines: QuoteLine[]
  ownerName: string | null
  ownerEmail: string | null
  sentAt: string | null
  answeredAt: string | null
  reason: string | null
}
