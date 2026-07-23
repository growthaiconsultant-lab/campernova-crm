/**
 * Evaluación pura del preflight de I3C1B (contract `deliveries.offer_id`).
 *
 * Separa la DECISIÓN (código de salida + checks fallidos) de la E/S SQL, para poder probar el
 * contrato de salida (§13) sin base de datos. El script `scripts/check-delivery-offer-nulls.ts`
 * recoge los valores reales por SQL y llama aquí.
 *
 * `THE I3C1B REMOTE PREFLIGHT VALIDATES DATA AND EXPAND-SCHEMA STRUCTURE`
 *
 * Exit codes: 0 = todas las invariantes se cumplen · 1 = anomalía de datos o de estructura ·
 * (2 = error de config/conexión lo decide el script, no este evaluador).
 */

/** Nombres de las migraciones expand/contract de I3C1 (identidad operativa del preflight). */
export const I3C1A_EXPAND_MIGRATION = '20260721100000_add_delivery_offer_link_expand'
export const I3C1B_CONTRACT_MIGRATION = '20260721200000_make_delivery_offer_link_required'

/** Estado observado de datos + estructura del expand schema. */
export type DeliveryOfferChecks = {
  // Datos.
  nullOfferIds: number
  orphans: number
  incoherent: number
  dupActive: number
  failedMigrations: number
  // Estructura de columna.
  tableExists: boolean
  offerIdColumnExists: boolean
  offerIdIsNullable: boolean // information_schema is_nullable = 'YES'
  offerIdType: string // esperado 'text'
  offerIdHasDefault: boolean
  // FK.
  fkPresentValid: boolean
  fkOnDeleteNoAction: boolean // confdeltype = 'a'
  fkOnUpdateCascade: boolean // confupdtype = 'c'
  // Índices.
  normalIndexPresent: boolean // deliveries_offer_id_idx, no único, sobre offer_id
  partialIndexPresent: boolean // deliveries_active_vehicle_key
  partialIndexUnique: boolean
  partialIndexPredicateOk: boolean // predicado contiene PROGRAMADA y EN_CURSO
  // Historial de migraciones.
  i3c1aApplied: boolean
  i3c1bApplied: boolean
  /**
   * Contrato de nullability esperado:
   *  - true  → PREFLIGHT antes del contract: offer_id debe seguir NULLABLE y I3C1B no aplicada.
   *  - false → POSTFLIGHT tras el contract: offer_id debe ser NOT NULL y I3C1B aplicada.
   */
  expectNullable: boolean
}

export type PreflightVerdict = { code: 0 | 1; failed: string[] }

/**
 * Decide el veredicto (código + lista de checks fallidos) a partir del estado observado.
 * Fail-closed: cualquier discrepancia estructural o de datos → code 1.
 */
export function evaluateDeliveryOfferPreflight(c: DeliveryOfferChecks): PreflightVerdict {
  const failed: string[] = []
  const fail = (label: string, bad: boolean) => {
    if (bad) failed.push(label)
  }

  // Estructura mínima.
  fail('tabla deliveries ausente', !c.tableExists)
  fail('columna offer_id ausente', !c.offerIdColumnExists)
  fail('offer_id no es text', c.offerIdColumnExists && c.offerIdType !== 'text')
  fail('offer_id tiene default', c.offerIdHasDefault)

  // FK.
  fail('FK deliveries_offer_id_fkey ausente o inválida', !c.fkPresentValid)
  fail('FK delete != NO ACTION', c.fkPresentValid && !c.fkOnDeleteNoAction)
  fail('FK update != CASCADE', c.fkPresentValid && !c.fkOnUpdateCascade)

  // Índices.
  fail('índice deliveries_offer_id_idx ausente/inválido', !c.normalIndexPresent)
  fail('índice parcial deliveries_active_vehicle_key ausente', !c.partialIndexPresent)
  fail('índice parcial no es UNIQUE', c.partialIndexPresent && !c.partialIndexUnique)
  fail(
    'predicado del índice parcial inesperado',
    c.partialIndexPresent && !c.partialIndexPredicateOk
  )

  // Historial de migraciones: I3C1A siempre debe estar aplicada.
  fail('I3C1A (expand) no aplicada', !c.i3c1aApplied)
  fail('migraciones fallidas activas', c.failedMigrations > 0)

  // Contrato de nullability + estado de I3C1B.
  if (c.expectNullable) {
    fail('offer_id ya no es nullable (pre-contract)', c.offerIdColumnExists && !c.offerIdIsNullable)
    fail('I3C1B ya aplicada (pre-contract)', c.i3c1bApplied)
  } else {
    fail('offer_id sigue nullable (post-contract)', c.offerIdColumnExists && c.offerIdIsNullable)
    fail('I3C1B no aplicada (post-contract)', !c.i3c1bApplied)
  }

  // Datos.
  fail('offer_id NULL presentes', c.nullOfferIds > 0)
  fail('Deliveries huérfanas', c.orphans > 0)
  fail('incoherencia Offer↔Delivery', c.incoherent > 0)
  fail('vehículos con >1 Delivery activa', c.dupActive > 0)

  return { code: failed.length === 0 ? 0 : 1, failed }
}
