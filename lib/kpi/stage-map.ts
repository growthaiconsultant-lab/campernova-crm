import type { BuyerLeadStatus, SellerLeadStatus, VehicleStatus } from '@prisma/client'

/**
 * Bloque F0 KPIs — adaptador de estados reales (enums en español) a las etapas
 * de funnel del spec. Evita migrar los enums: los KPIs de conversión leen la
 * etapa a través de este mapa. Cero riesgo, cero migración de datos.
 */

/** Etapas del funnel comprador (spec §6.5 / CRM10). */
export const BUYER_FUNNEL_STAGES = [
  'lead',
  'contactado',
  'cualificado',
  'cita',
  'oferta',
  'reserva',
  'venta',
] as const
export type BuyerFunnelStage = (typeof BUYER_FUNNEL_STAGES)[number]

/** Etapas del funnel vendedor/vehículo (spec §6.6 / CRM11). */
export const SELLER_FUNNEL_STAGES = [
  'lead',
  'cualificado',
  'captado',
  'publicado',
  'reservado',
  'vendido',
] as const
export type SellerFunnelStage = (typeof SELLER_FUNNEL_STAGES)[number]

/** Mínima etapa de funnel alcanzada por el estado del lead comprador. */
export function buyerLeadStage(status: BuyerLeadStatus): BuyerFunnelStage {
  switch (status) {
    case 'NUEVO':
      return 'lead'
    case 'CONTACTADO':
      return 'contactado'
    case 'CUALIFICADO':
      return 'cualificado'
    case 'EN_NEGOCIACION':
      return 'oferta'
    case 'CERRADO':
      return 'venta'
    default:
      return 'lead' // PERDIDO → cae fuera del funnel activo
  }
}

/** Etapa del funnel vendedor a partir del estado del vehículo (más informativo que el del lead). */
export function vehicleStage(status: VehicleStatus): SellerFunnelStage {
  switch (status) {
    case 'NUEVO':
      return 'captado'
    case 'TASADO':
      return 'captado'
    case 'PUBLICADO':
      return 'publicado'
    case 'RESERVADO':
      return 'reservado'
    case 'VENDIDO':
      return 'vendido'
    default:
      return 'captado' // DESCARTADO → fuera del funnel
  }
}

/** Etapa del funnel vendedor cuando aún no hay vehículo, a partir del lead. */
export function sellerLeadStage(status: SellerLeadStatus): SellerFunnelStage {
  switch (status) {
    case 'NUEVO':
    case 'CONTACTADO':
      return 'lead'
    case 'CUALIFICADO':
    case 'EN_NEGOCIACION':
      return 'cualificado'
    case 'CERRADO':
      return 'captado'
    default:
      return 'lead'
  }
}

export const BUYER_STATUSES_TERMINAL: BuyerLeadStatus[] = ['CERRADO', 'PERDIDO']
export const SELLER_STATUSES_TERMINAL: SellerLeadStatus[] = ['CERRADO', 'DESCARTADO']
