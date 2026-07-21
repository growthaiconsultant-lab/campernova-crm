import type { SellerLeadStatus, VehicleStatus, BuyerLeadStatus } from '@prisma/client'

export const SELLER_LEAD_TRANSITIONS: Partial<Record<SellerLeadStatus, SellerLeadStatus[]>> = {
  NUEVO: ['CONTACTADO', 'DESCARTADO'],
  CONTACTADO: ['CUALIFICADO', 'DESCARTADO'],
  CUALIFICADO: ['EN_NEGOCIACION', 'DESCARTADO'],
  EN_NEGOCIACION: ['CERRADO', 'DESCARTADO'],
}

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
 * `DISCARD BLOCKERS AND ROOT LOCK COORDINATION REMAIN PENDING UNTIL I3B` — el descarte desde
 * `NUEVO`, `TASADO` y `PUBLICADO` conserva su comportamiento actual y todavía no comprueba ofertas
 * ni entregas activas.
 */
export const VEHICLE_TRANSITIONS: Partial<Record<VehicleStatus, VehicleStatus[]>> = {
  NUEVO: ['TASADO', 'DESCARTADO'],
  TASADO: ['PUBLICADO', 'DESCARTADO'],
  PUBLICADO: ['DESCARTADO'],
}

export const BUYER_LEAD_TRANSITIONS: Partial<Record<BuyerLeadStatus, BuyerLeadStatus[]>> = {
  NUEVO: ['CONTACTADO', 'PERDIDO'],
  CONTACTADO: ['CUALIFICADO', 'PERDIDO'],
  CUALIFICADO: ['EN_NEGOCIACION', 'PERDIDO'],
  EN_NEGOCIACION: ['CERRADO', 'PERDIDO'],
}

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
