/**
 * Bloque F0 KPIs — catálogo de nombres de evento (fuente de verdad).
 * `KpiEvent.eventName` es String en la BD (para no migrar al añadir eventos);
 * aquí se centralizan los válidos con tipado para el emisor y los agregadores.
 */

export const KPI_EVENTS = {
  // Leads / CRM
  LEAD_CREATED: 'lead_created',
  LEAD_CONTACTED: 'lead_contacted',
  LEAD_QUALIFIED: 'lead_qualified',
  LEAD_LOST: 'lead_lost',
  // Compradores / vendedores
  BUYER_CREATED: 'buyer_created',
  SELLER_CREATED: 'seller_created',
  // Vehículos
  VEHICLE_CAPTURED: 'vehicle_captured',
  VEHICLE_VALUED: 'vehicle_valued',
  VEHICLE_PUBLISHED: 'vehicle_published',
  VEHICLE_SOLD: 'vehicle_sold',
  // Trust
  TRUST_PASSPORT_GRANTED: 'trust_passport_granted',
  TRUST_PASSPORT_REVOKED: 'trust_passport_revoked',
  // Matching
  MATCH_GENERATED: 'match_generated',
  MATCH_SENT: 'match_sent',
  // Comercial / transacción
  APPOINTMENT_CREATED: 'appointment_created',
  APPOINTMENT_COMPLETED: 'appointment_completed',
  OFFER_CREATED: 'offer_created',
  RESERVATION_CREATED: 'reservation_created',
  RESERVATION_CANCELLED: 'reservation_cancelled',
  SALE_CLOSED: 'sale_closed',
  DELIVERY_COMPLETED: 'delivery_completed',
} as const

export type KpiEventName = (typeof KPI_EVENTS)[keyof typeof KPI_EVENTS]

/** Entidades de negocio a las que se ancla un evento. */
export type KpiEntityType =
  | 'lead'
  | 'buyer'
  | 'seller'
  | 'vehicle'
  | 'match'
  | 'offer'
  | 'appointment'
  | 'delivery'

/** Origen del evento (para trazabilidad / auditoría). */
export type KpiSource = 'ui' | 'system' | 'chat' | 'cron'
