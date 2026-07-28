/**
 * A3 — Tasación OFICIAL del vehículo (núcleo transaccional). Mismo patrón que `validateEntryTx`:
 *
 *   1. lectura preliminar (fuera) resuelve las raíces `Vehicle → SellerLead`;
 *   2. `withLockedRoots` bloquea las raíces en orden y abre la transacción;
 *   3. relectura DENTRO de la transacción (fail-closed): `VEHICLE_ROOT_CHANGED`, `LEAD_ARCHIVED`;
 *   4. GATE ESTRICTO: entrada oficial activa + inspección de entrada COMPLETADA + estado elegible;
 *   5. cálculo (AUTO) o validación (MANUAL) bajo el lock;
 *   6. escritura atómica: Attempt (siempre) + Valuation (si COMPLETADA) + denormalizados oficiales +
 *      CAS `NUEVO → TASADO` + Activity.
 *
 * Gate estricto (D5): sin inspección COMPLETADA NO hay tasación oficial. No hay bypass manual en v1.
 * `NUEVO → TASADO` sucede EXCLUSIVAMENTE por esta vía. La valoración preliminar nunca cambia estado.
 * Un intento SIN cifras (SIN_REFERENCIA / FALLO_TECNICO) se registra sin tocar el vehículo.
 *
 * Efectos externos (revalidate/KPIs/matching) van FUERA de la transacción, en el server action.
 */
import type { Prisma, PrismaClient, ValuationConfidence } from '@prisma/client'
import type { LockRoot } from '@/lib/locking'
import { calculateValuation } from './calculate'
import { ValuationError } from './errors'
import { officialRequestFingerprint } from './idempotency'
import { referenceUsedLabel, resultToOutcome, validateManualValuation } from './outcome'
import { prismaValuationDeps } from './prisma-deps'
import type { ValuationVehicleInput } from './types'

/** Estados de vehículo en los que la tasación oficial NO es ejecutable (terminales/venta). */
export const OFFICIAL_VALUATION_BLOCKED_VEHICLE_STATUSES = ['VENDIDO', 'DESCARTADO'] as const

/**
 * Raíces a bloquear para tasar oficialmente: `Vehicle → SellerLead`. El orden global lo fija
 * `withLockedRoots`. El comprador no interviene (la tasación es fase del vendedor/vehículo).
 */
export function buildOfficialValuationRoots(p: {
  vehicleId: string
  sellerLeadId: string | null
}): LockRoot[] {
  return [
    { type: 'vehicle', id: p.vehicleId },
    ...(p.sellerLeadId ? ([{ type: 'sellerLead', id: p.sellerLeadId }] as LockRoot[]) : []),
  ]
}

export type OfficialValuationMode =
  | { kind: 'AUTO'; input: ValuationVehicleInput }
  | {
      kind: 'MANUAL'
      min: number
      recommended: number
      max: number
      confidence: ValuationConfidence
      reason: string
      referenceUsed?: string | null
    }

export type OfficialValuationParams = {
  vehicleId: string
  /** `sellerLeadId` observado en la lectura preliminar; detecta que la raíz cambió. */
  resolvedSellerLeadId: string | null
  actorId: string
  /**
   * Clave de idempotencia generada por el cliente (una por intención de tasar). Un reintento de
   * transporte reutiliza la misma clave → se devuelve el intento ya creado. Una nueva tasación
   * intencionada usa una clave nueva.
   */
  idempotencyKey: string
  mode: OfficialValuationMode
}

export type OfficialValuationHooks = {
  /** Sincronización determinista para tests de concurrencia (antes de la escritura). */
  beforeWrite?: () => Promise<void>
}

export type OfficialValuationResult = {
  outcome: 'COMPLETADA' | 'SIN_REFERENCIA'
  attemptId: string
  /** Id de la `Valuation` creada (solo cuando COMPLETADA). */
  valuationId: string | null
  /** `true` si esta tasación disparó la transición `NUEVO → TASADO`. */
  transitioned: boolean
}

/**
 * Ejecuta la tasación oficial DENTRO de la transacción abierta por `withLockedRoots`. Debe
 * invocarse DENTRO de `withLockedRoots(buildOfficialValuationRoots(...), ...)`.
 *
 * Un fallo técnico del cálculo AUTO LANZA (aborta la tx → no deja el vehículo a medias); el server
 * action registra entonces el intento FALLO_TECNICO fuera de la transacción.
 */
export async function officialValuationTx(
  tx: Prisma.TransactionClient,
  p: OfficialValuationParams,
  hooks: OfficialValuationHooks = {}
): Promise<OfficialValuationResult> {
  // (0) Idempotencia bajo el lock, VINCULADA a la petición. Huella determinista del payload
  //     (`officialRequestFingerprint`). Si ya existe un intento con esta clave:
  //       · mismo vehículo + misma huella → es el MISMO intento → se devuelve sin re-ejecutar
  //         (no crea 2.º Attempt/Valuation/Activity ni re-transiciona);
  //       · cualquier diferencia (otro vehículo, otro modo, otro rango/confianza/motivo) →
  //         reutilización incompatible → `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST` (nunca se
  //         devuelve un resultado ajeno).
  //     Barrera frente a doble submit serializado por el lock del vehículo; el unique GLOBAL es la
  //     barrera final. El `FALLO_TECNICO` previo de la MISMA petición → `VALUATION_ATTEMPT_FAILED`.
  const fingerprint = officialRequestFingerprint({ vehicleId: p.vehicleId, mode: p.mode })
  const prior = await tx.vehicleValuationAttempt.findUnique({
    where: { idempotencyKey: p.idempotencyKey },
    select: {
      id: true,
      outcome: true,
      valuationId: true,
      vehicleId: true,
      requestFingerprint: true,
    },
  })
  if (prior) {
    if (prior.vehicleId !== p.vehicleId || prior.requestFingerprint !== fingerprint) {
      throw new ValuationError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST')
    }
    if (prior.outcome === 'FALLO_TECNICO') throw new ValuationError('VALUATION_ATTEMPT_FAILED')
    return {
      outcome: prior.outcome as 'COMPLETADA' | 'SIN_REFERENCIA',
      attemptId: prior.id,
      valuationId: prior.valuationId,
      transitioned: false,
    }
  }

  // (1) Relectura del vehículo + consistencia de raíz.
  const vehicle = await tx.vehicle.findUnique({
    where: { id: p.vehicleId },
    select: {
      status: true,
      sellerLeadId: true,
      entryValidatedAt: true,
      entryAnnulledAt: true,
    },
  })
  if (!vehicle) throw new ValuationError('VEHICLE_NOT_FOUND')
  if (vehicle.sellerLeadId !== p.resolvedSellerLeadId)
    throw new ValuationError('VEHICLE_ROOT_CHANGED')

  // (2) Vendedor: existe y no archivado.
  const seller = await tx.sellerLead.findUnique({
    where: { id: vehicle.sellerLeadId },
    select: { archivedAt: true },
  })
  if (!seller) throw new ValuationError('SELLER_LEAD_NOT_FOUND')
  if (seller.archivedAt != null) throw new ValuationError('LEAD_ARCHIVED')

  // (3) Estado elegible: no ejecutable en VENDIDO/DESCARTADO.
  if ((OFFICIAL_VALUATION_BLOCKED_VEHICLE_STATUSES as readonly string[]).includes(vehicle.status)) {
    throw new ValuationError('VEHICLE_STATUS_NOT_ELIGIBLE')
  }

  // (4) GATE: entrada oficial activa (validada y no anulada).
  if (!(vehicle.entryValidatedAt != null && vehicle.entryAnnulledAt == null)) {
    throw new ValuationError('ENTRY_NOT_ACTIVE')
  }

  // (5) GATE: inspección de entrada COMPLETADA (señal estructurada de Taller; D2).
  const completedInspections = await tx.workOrder.count({
    where: { vehicleId: p.vehicleId, kind: 'INSPECCION_ENTRADA', status: 'COMPLETADA' },
  })
  if (completedInspections === 0) throw new ValuationError('INSPECTION_NOT_COMPLETED')

  // (6) Cálculo (AUTO) o validación (MANUAL) — bajo el lock.
  let figures: { min: number; recommended: number; max: number } | null
  let confidence: ValuationConfidence | null
  let referenceUsed: string | null
  let reason: string | null
  let parameters: object
  const method = p.mode.kind === 'AUTO' ? 'AUTO' : 'MANUAL'

  if (p.mode.kind === 'AUTO') {
    // Deps con el cliente transaccional: las lecturas del algoritmo ocurren bajo el lock.
    const deps = prismaValuationDeps(tx as unknown as PrismaClient)
    const result = await calculateValuation(p.mode.input, deps)
    if (resultToOutcome(result) === 'SIN_REFERENCIA') {
      figures = null
      confidence = null
      referenceUsed = null
      reason = null
      parameters = result.parameters as object
    } else {
      figures = { min: result.min, recommended: result.recommended, max: result.max }
      confidence = result.confidence
      referenceUsed = referenceUsedLabel(result)
      reason = null
      parameters = result.parameters as object
    }
  } else {
    const err = validateManualValuation(p.mode)
    if (err) throw new ValuationError(err)
    figures = { min: p.mode.min, recommended: p.mode.recommended, max: p.mode.max }
    confidence = p.mode.confidence
    referenceUsed = p.mode.referenceUsed ?? null
    reason = p.mode.reason.trim()
    parameters = { source: 'manual_official' }
  }

  await hooks.beforeWrite?.()

  // (7) SIN cifras (AUTO sin datos): registra el intento OFICIAL SIN_REFERENCIA. NO toca el vehículo.
  if (figures === null) {
    const attempt = await tx.vehicleValuationAttempt.create({
      data: {
        vehicleId: p.vehicleId,
        purpose: 'OFICIAL',
        outcome: 'SIN_REFERENCIA',
        method,
        createdById: p.actorId,
        idempotencyKey: p.idempotencyKey,
        requestFingerprint: fingerprint,
      },
      select: { id: true },
    })
    return {
      outcome: 'SIN_REFERENCIA',
      attemptId: attempt.id,
      valuationId: null,
      transitioned: false,
    }
  }

  // (8) COMPLETADA: crea la Valuation OFICIAL (historial).
  const valuation = await tx.valuation.create({
    data: {
      vehicleId: p.vehicleId,
      min: figures.min,
      recommended: figures.recommended,
      max: figures.max,
      method,
      confidence: confidence as ValuationConfidence,
      purpose: 'OFICIAL',
      parameters,
      createdById: p.actorId,
    },
    select: { id: true },
  })

  // (9) Denormalizados OFICIALES: la tasación oficial es la fuente del precio mostrado.
  await tx.vehicle.update({
    where: { id: p.vehicleId },
    data: {
      valuationMin: figures.min,
      valuationRecommended: figures.recommended,
      valuationMax: figures.max,
    },
  })

  // (10) CAS `NUEVO → TASADO` — única vía de esta transición. Bajo el lock, no hay carrera; el CAS
  //      garantiza además que solo la primera tasación oficial concurrente transiciona el estado.
  const cas = await tx.vehicle.updateMany({
    where: { id: p.vehicleId, status: 'NUEVO' },
    data: { status: 'TASADO' },
  })
  const transitioned = cas.count > 0

  // (11) Intento OFICIAL COMPLETADA enlazado a la Valuation.
  const attempt = await tx.vehicleValuationAttempt.create({
    data: {
      vehicleId: p.vehicleId,
      purpose: 'OFICIAL',
      outcome: 'COMPLETADA',
      method,
      confidence,
      min: figures.min,
      recommended: figures.recommended,
      max: figures.max,
      referenceUsed,
      reason,
      createdById: p.actorId,
      valuationId: valuation.id,
      idempotencyKey: p.idempotencyKey,
      requestFingerprint: fingerprint,
    },
    select: { id: true },
  })

  // (12) Traza (NO fuente de verdad). El estado se lee de las columnas del vehículo.
  await tx.activity.create({
    data: {
      type: 'CAMBIO_ESTADO',
      content: transitioned
        ? `Tasación oficial registrada (${method === 'MANUAL' ? 'manual' : 'automática'}) → Estado cambiado: Nuevo → Tasado`
        : `Tasación oficial registrada (${method === 'MANUAL' ? 'manual' : 'automática'})`,
      agentId: p.actorId,
      sellerLeadId: vehicle.sellerLeadId,
    },
  })

  return { outcome: 'COMPLETADA', attemptId: attempt.id, valuationId: valuation.id, transitioned }
}
