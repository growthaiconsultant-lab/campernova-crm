/**
 * PUB-1 — Despublicación de un anuncio: `PUBLICADO → TASADO` (retirar del catálogo).
 *
 * NO reutiliza `applyManualVehicleUpdateTx`: ese rechaza cualquier camino genérico hacia `TASADO`
 * con `OFFICIAL_VALUATION_REQUIRED`. La despublicación es una transición propia (retirar ≠ tasar),
 * con su núcleo transaccional dedicado, a invocar DENTRO de `withLockedRoots(buildVehicleUpdateRoots)`.
 *
 * Protocolo (mismo patrón que entrada/ofertas):
 *   1. relectura del vehículo bajo el lock (fail-closed): raíz consistente + vendedor no archivado;
 *   2. debe estar `PUBLICADO`;
 *   3. **guard de ofertas activas BAJO EL LOCK**: no se retira un anuncio con oferta viva
 *      (`isActiveHold`), que quedaría huérfana. El lock del root `vehicle` serializa esto con la
 *      creación/aceptación de ofertas (ambas toman el mismo lock);
 *   4. CAS sobre `status = 'PUBLICADO'` → `TASADO`. **`publishedAt` se CONSERVA** (historial de
 *      primera publicación; republicar no la reescribe);
 *   5. traza `Activity` `PUBLICACION_RETIRADA` (motivo/actor). NO es fuente de verdad.
 */
import type { Prisma } from '@prisma/client'
import { ACTIVE_OFFER_STATUSES } from '@/lib/lead-archiving/domain'
import { VehicleStatusConflictError } from '@/lib/vehicle-status'

export type UnpublishErrorCode =
  | 'VEHICLE_NOT_FOUND'
  | 'VEHICLE_ROOT_CHANGED'
  | 'LEAD_ARCHIVED'
  | 'NOT_PUBLISHED'
  | 'ACTIVE_OFFERS'

/** Mensajes visibles: sin ids, estado interno, SQL, Prisma, stack ni PII. */
export const UNPUBLISH_ERROR_MESSAGES: Record<UnpublishErrorCode, string> = {
  VEHICLE_NOT_FOUND: 'Vehículo no encontrado',
  VEHICLE_ROOT_CHANGED:
    'Los datos del vehículo han cambiado mientras se procesaba. Inténtalo de nuevo.',
  LEAD_ARCHIVED: 'No se puede retirar el anuncio de un vendedor archivado. Reactívalo primero.',
  NOT_PUBLISHED: 'El vehículo no está publicado.',
  ACTIVE_OFFERS: 'No se puede retirar el anuncio: hay ofertas activas sobre este vehículo.',
}

export class UnpublishError extends Error {
  readonly code: UnpublishErrorCode
  constructor(code: UnpublishErrorCode) {
    super(UNPUBLISH_ERROR_MESSAGES[code])
    this.name = 'UnpublishError'
    this.code = code
  }
}

export function isUnpublishError(err: unknown): err is UnpublishError {
  return err instanceof UnpublishError
}

export type UnpublishVehicleParams = {
  vehicleId: string
  /** `sellerLeadId` observado en la lectura preliminar; detecta que la raíz cambió. */
  resolvedSellerLeadId: string | null
  actorId: string
  /** Motivo opcional (se guarda en la traza). */
  reason: string | null
}

export type UnpublishVehicleHooks = {
  /** Sincronización determinista para tests de concurrencia (antes de la escritura). */
  beforeWrite?: () => Promise<void>
}

export async function unpublishVehicleTx(
  tx: Prisma.TransactionClient,
  p: UnpublishVehicleParams,
  hooks: UnpublishVehicleHooks = {}
): Promise<{ vehicleId: string }> {
  // (1) Relectura bajo el lock + consistencia de raíz.
  const vehicle = await tx.vehicle.findUnique({
    where: { id: p.vehicleId },
    select: { status: true, sellerLeadId: true, publishedAt: true },
  })
  if (!vehicle) throw new UnpublishError('VEHICLE_NOT_FOUND')
  if (vehicle.sellerLeadId !== p.resolvedSellerLeadId)
    throw new UnpublishError('VEHICLE_ROOT_CHANGED')

  if (vehicle.sellerLeadId) {
    const seller = await tx.sellerLead.findUnique({
      where: { id: vehicle.sellerLeadId },
      select: { archivedAt: true },
    })
    if (seller?.archivedAt != null) throw new UnpublishError('LEAD_ARCHIVED')
  }

  // (2) Debe estar publicado.
  if (vehicle.status !== 'PUBLICADO') throw new UnpublishError('NOT_PUBLISHED')

  // (3) Guard de ofertas activas BAJO EL LOCK (no se retira con oferta viva).
  const activeOffers = await tx.offer.count({
    where: { vehicleId: p.vehicleId, status: { in: ACTIVE_OFFER_STATUSES } },
  })
  if (activeOffers > 0) throw new UnpublishError('ACTIVE_OFFERS')

  await hooks.beforeWrite?.()

  // (4) CAS: PUBLICADO → TASADO. `publishedAt` NO se toca (se conserva).
  const cas = await tx.vehicle.updateMany({
    where: { id: p.vehicleId, status: 'PUBLICADO' },
    data: { status: 'TASADO' },
  })
  if (cas.count === 0) throw new VehicleStatusConflictError()

  // (5) Traza (NO fuente de verdad). El estado se lee de vehicles.status.
  await tx.activity.create({
    data: {
      type: 'PUBLICACION_RETIRADA',
      content: p.reason?.trim()
        ? `Anuncio retirado. Motivo: ${p.reason.trim()}`
        : 'Anuncio retirado',
      agentId: p.actorId,
      sellerLeadId: vehicle.sellerLeadId,
    },
  })

  return { vehicleId: p.vehicleId }
}
