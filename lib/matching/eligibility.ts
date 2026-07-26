import type { BuyerLeadStatus, Prisma, VehicleStatus } from '@prisma/client'

/**
 * Política de elegibilidad canónica del matching (Workstream B / M1).
 *
 * Fuente ÚNICA de verdad para "¿este vehículo / comprador puede participar en el
 * matching?" — reutilizada en la generación (subject-side), en las listas de
 * contraparte, en la recalculación (heredado vía find.ts) y en la re-lectura de
 * matches persistidos (fichas + KPIs + inventario).
 *
 * Se expone en dos formas equivalentes:
 *  - Predicados puros (`isVehicleEligible` / `isBuyerEligible`) para evaluar filas
 *    ya cargadas en memoria (re-filtrado de lectura).
 *  - Fragmentos `where` de Prisma para filtrar en la query.
 *
 * ⚠️ REGLA PROVISIONAL (interina hasta A2): un vehículo es elegible por
 * `status ∈ {TASADO, PUBLICADO}` + vendedor no archivado. A2 AÑADIRÁ la condición
 * `entryValidatedAt != null AND entryAnnulledAt == null` cuando esos campos
 * existan en el schema. NO se añaden aquí (aún no existen en `main`).
 */

// Vehículo elegible: en stock comercializable. (Provisional hasta A2 — ver arriba.)
export const ELIGIBLE_VEHICLE_STATUSES = ['TASADO', 'PUBLICADO'] as const

// Comprador NO elegible: estados terminales/incompatibles. (Ver prisma-deps original.)
export const INELIGIBLE_BUYER_STATUSES = ['CERRADO', 'PERDIDO'] as const

export type VehicleEligibilityInput = {
  status: VehicleStatus
  /** `SellerLead.archivedAt` del vendedor dueño del vehículo (null = no archivado). */
  sellerArchivedAt: Date | null
}

export type BuyerEligibilityInput = {
  status: BuyerLeadStatus
  /** `BuyerLead.archivedAt` (null = no archivado). */
  archivedAt: Date | null
}

/** Predicado puro: ¿es elegible este vehículo para el matching? */
export function isVehicleEligible(input: VehicleEligibilityInput): boolean {
  return (
    (ELIGIBLE_VEHICLE_STATUSES as readonly string[]).includes(input.status) &&
    input.sellerArchivedAt == null
  )
}

/** Predicado puro: ¿es elegible este comprador para el matching? */
export function isBuyerEligible(input: BuyerEligibilityInput): boolean {
  return (
    !(INELIGIBLE_BUYER_STATUSES as readonly string[]).includes(input.status) &&
    input.archivedAt == null
  )
}

// ── Fragmentos `where` de Prisma (misma política, para filtrar en la query) ──

/** Vehículos elegibles: stock comercializable + vendedor no archivado. */
export const eligibleVehicleWhere: Prisma.VehicleWhereInput = {
  status: { in: [...ELIGIBLE_VEHICLE_STATUSES] },
  sellerLead: { archivedAt: null },
}

/** Compradores elegibles: estado no terminal + no archivado. */
export const eligibleBuyerWhere: Prisma.BuyerLeadWhereInput = {
  status: { notIn: [...INELIGIBLE_BUYER_STATUSES] },
  archivedAt: null,
}

/** Matches cuya CONTRAPARTE comprador es elegible (para contar desde un vehículo). */
export const eligibleBuyerCounterpartMatchWhere: Prisma.MatchWhereInput = {
  buyerLead: eligibleBuyerWhere,
}

/** Matches cuya CONTRAPARTE vehículo es elegible (para contar desde un comprador). */
export const eligibleVehicleCounterpartMatchWhere: Prisma.MatchWhereInput = {
  vehicle: eligibleVehicleWhere,
}

/** Matches con AMBAS partes elegibles (para KPIs de matching). */
export const eligibleMatchWhere: Prisma.MatchWhereInput = {
  vehicle: eligibleVehicleWhere,
  buyerLead: eligibleBuyerWhere,
}
