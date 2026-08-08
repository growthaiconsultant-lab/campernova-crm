import type { MatchLinkReason } from '@prisma/client'

export const MANUAL_MATCH_LINK_REASONS = [
  'INTERES_COMPRADOR',
  'RECOMENDACION_EQUIPO',
  'SEGUIMIENTO_COMERCIAL',
  'VISITA_RELACIONADA',
  'OTRO',
] as const satisfies readonly MatchLinkReason[]

export const MANUAL_MATCH_LINK_REASON_LABELS: Record<MatchLinkReason, string> = {
  INTERES_COMPRADOR: 'Interés del comprador',
  RECOMENDACION_EQUIPO: 'Recomendación del equipo',
  SEGUIMIENTO_COMERCIAL: 'Seguimiento comercial',
  VISITA_RELACIONADA: 'Visita relacionada',
  OTRO: 'Otro',
}

export const MANUAL_MATCH_LINK_NOTES_MAX_LENGTH = 500
