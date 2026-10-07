import { z } from 'zod'

/** Origen comercial; distinto del source técnico de los eventos KPI. */
export const BUYER_SOURCE_VALUES = [
  'INSTAGRAM',
  'COCHES_NET',
  'WALLAPOP',
  'WEB',
  'PRESENCIAL',
  'LLAMADA',
  'OTROS',
  'CHAT',
  'CHAT_WEB',
  'PRO',
] as const
export type BuyerSource = (typeof BUYER_SOURCE_VALUES)[number]
export const buyerSourceSchema = z
  .enum(BUYER_SOURCE_VALUES, {
    error: 'Selecciona un origen de captación válido.',
  })
  .nullable()
  .optional()

export const BUYER_SOURCE_OPTIONS: { value: BuyerSource; label: string }[] = [
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'COCHES_NET', label: 'Coches.net' },
  { value: 'WALLAPOP', label: 'Wallapop' },
  { value: 'WEB', label: 'Web' },
  { value: 'PRESENCIAL', label: 'Presencial / físico' },
  { value: 'LLAMADA', label: 'Llamada' },
  { value: 'OTROS', label: 'Otros' },
  { value: 'CHAT', label: 'Chat web' },
  { value: 'PRO', label: 'Formulario web' },
]

export function isBuyerSource(value: string | null | undefined): value is BuyerSource {
  return BUYER_SOURCE_VALUES.some((source) => source === value)
}
export function buyerSourceLabel(value: string | null | undefined): string {
  if (!value) return 'Sin especificar'
  if (value === 'CHAT_WEB') return 'Chat web'
  return BUYER_SOURCE_OPTIONS.find((option) => option.value === value)?.label ?? value
}
/** Web agrupa los puntos de entrada web; los filtros específicos siguen disponibles. */
export function buyerSourceFilter(value: string) {
  if (value === '__none__') return { source: null }
  if (value === 'WEB') return { source: { in: ['WEB', 'PRO', 'CHAT', 'CHAT_WEB'] } }
  if (value === 'CHAT' || value === 'CHAT_WEB') return { source: { in: ['CHAT', 'CHAT_WEB'] } }
  return { source: value }
}
