import type { SellerLeadStatus, VehicleStatus, BuyerLeadStatus } from '@prisma/client'

const SELLER_LEAD_STATUSES: SellerLeadStatus[] = [
  'NUEVO',
  'CONTACTADO',
  'CUALIFICADO',
  'EN_NEGOCIACION',
  'CERRADO',
  'DESCARTADO',
]

const BUYER_LEAD_STATUSES: BuyerLeadStatus[] = [
  'NUEVO',
  'CONTACTADO',
  'CUALIFICADO',
  'EN_NEGOCIACION',
  'CERRADO',
  'PERDIDO',
]

function allOtherStatuses<T extends string>(statuses: T[], current: T): T[] {
  return statuses.filter((status) => status !== current)
}

/**
 * El estado del lead es una clasificación operativa corregible, no un gate del funnel. Cualquier
 * estado válido puede sustituir al actual; la Activity de la action conserva la traza del salto.
 */
export const SELLER_LEAD_TRANSITIONS: Record<SellerLeadStatus, SellerLeadStatus[]> =
  Object.fromEntries(
    SELLER_LEAD_STATUSES.map((status) => [status, allOtherStatuses(SELLER_LEAD_STATUSES, status)])
  ) as Record<SellerLeadStatus, SellerLeadStatus[]>

/**
 * Transiciones de `Vehicle.status` que puede ejecutar la **edición manual** (`updateVehicle`).
 *
 * No es el catálogo de transiciones posibles del vehículo: es el subconjunto del que la edición
 * manual es propietaria. Las demás pertenecen a su dominio y se ejecutan allí:
 *
 * `OFFER OWNS PUBLICADO ↔ RESERVADO`
 * `DELIVERY OWNS THE TRANSITION TO VENDIDO`
 *
 * `I3A REMOVES MANUAL RESERVATION, RELEASE AND SALE TRANSITIONS FROM updateVehicle`
 *
 * `RESERVADO` no tiene salidas manuales: un vehículo reservado tiene una oferta `ACEPTADA` viva
 * (invariante de I2C), así que liberarlo, venderlo o descartarlo a mano invadiría el dominio de
 * ofertas o dejaría esa oferta huérfana. Se sale de `RESERVADO` cancelando o convirtiendo la oferta,
 * o completando la entrega. `isValidTransition` admite `from === to`, de modo que los campos de un
 * vehículo reservado siguen siendo editables.
 *
 * `TEMPORARY MANUAL DISCARD REMOVAL IS A SAFETY MEASURE UNTIL I3D` — I3B retira todas las
 * transiciones manuales a `DESCARTADO`. Descartar un vehículo debe bloquear ofertas y entregas
 * activas, pero `createDelivery` sigue sin coordinar y puede crear una entrega **después** del
 * descarte; coordinar el descarte ahora daría una garantía falsa. Se reintroducirá en I3D, ya
 * coordinado, cuando I3C haya puesto Delivery bajo el protocolo.
 * `FINAL DISCARD COORDINATION REMAINS PENDING UNTIL DELIVERY IS COORDINATED`.
 *
 * `A3 REMOVES THE MANUAL NUEVO → TASADO TRANSITION` — `NUEVO` ya no tiene salidas manuales. La
 * primera transición `NUEVO → TASADO` es consecuencia EXCLUSIVA de una tasación OFICIAL completada
 * (`officialValuationTx`, gated por entrada activa + inspección de entrada COMPLETADA), que la
 * ejecuta con su propio CAS sin consultar esta tabla. `OFFICIAL VALUATION OWNS THE FIRST
 * NUEVO → TASADO`. Un intento genérico de alcanzar `TASADO` por edición manual se rechaza con
 * `OFFICIAL_VALUATION_REQUIRED` (`lib/vehicle-status.ts`). `NUEVO` se conserva en el mapa con lista
 * vacía (no es terminal: la UI no lo etiqueta «estado final», solo deja de ofrecer `TASADO`).
 */
export const VEHICLE_TRANSITIONS: Partial<Record<VehicleStatus, VehicleStatus[]>> = {
  NUEVO: [],
  TASADO: ['PUBLICADO'],
}

/**
 * Igual que en vendedores, todos los saltos son corregibles. El destino `CERRADO` permanece en el
 * catálogo para la UI, pero `updateBuyerLead` conserva su guard de Delivery COMPLETADA.
 */
export const BUYER_LEAD_TRANSITIONS: Record<BuyerLeadStatus, BuyerLeadStatus[]> =
  Object.fromEntries(
    BUYER_LEAD_STATUSES.map((status) => [status, allOtherStatuses(BUYER_LEAD_STATUSES, status)])
  ) as Record<BuyerLeadStatus, BuyerLeadStatus[]>

export function isValidTransition<T extends string>(
  transitions: Partial<Record<T, T[]>>,
  from: T,
  to: T
): boolean {
  if (from === to) return true
  return transitions[from]?.includes(to) ?? false
}

export const SELLER_LEAD_STATUS_LABELS: Record<SellerLeadStatus, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CUALIFICADO: 'Cualificado',
  EN_NEGOCIACION: 'En negociación',
  CERRADO: 'Cerrado',
  DESCARTADO: 'Descartado',
}

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  NUEVO: 'Nuevo',
  TASADO: 'Tasado',
  PUBLICADO: 'Publicado',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
  DESCARTADO: 'Descartado',
}

export const BUYER_LEAD_STATUS_LABELS: Record<BuyerLeadStatus, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CUALIFICADO: 'Cualificado',
  EN_NEGOCIACION: 'En negociación',
  CERRADO: 'Cerrado',
  PERDIDO: 'Perdido',
}

export const SELLER_LEAD_STATUS_CLASSES: Record<SellerLeadStatus, string> = {
  NUEVO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  CONTACTADO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  CUALIFICADO: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  EN_NEGOCIACION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  CERRADO: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  DESCARTADO: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export const VEHICLE_STATUS_CLASSES: Record<VehicleStatus, string> = {
  NUEVO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  TASADO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  PUBLICADO: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  RESERVADO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  VENDIDO: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  DESCARTADO: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export const BUYER_LEAD_STATUS_CLASSES: Record<BuyerLeadStatus, string> = {
  NUEVO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  CONTACTADO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  CUALIFICADO: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  EN_NEGOCIACION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  CERRADO: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  PERDIDO: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}
