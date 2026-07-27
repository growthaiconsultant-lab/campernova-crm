/**
 * PR-A2 — Registro de la llegada física del vehículo a la nave (corrección 7.1).
 *
 * La llegada física es un HITO PERSISTIDO previo a la entrada oficial ("llegada física → entrada
 * oficial validada"). Antes vivía como un booleano transitorio del formulario de validación; ahora
 * se persiste en las columnas `physicalArrivalAt`/`physicalArrivalById` del vehículo, y la validación
 * de la entrada exige `physicalArrivalAt != null` (releído bajo el lock).
 *
 * Corre bajo el mismo protocolo de root locks + CAS que la validación/anulación (`Vehicle →
 * SellerLead`). Es IDEMPOTENTE: registrar la llegada de un vehículo que ya la tiene es un no-op (no
 * reescribe fecha/actor ni duplica Activity).
 *
 * `ARRIVAL IS A DISTINCT EARLIER MILESTONE THAN OFFICIAL ENTRY VALIDATION`.
 * `ENTRY STATE IS READ FROM THE VEHICLE COLUMNS, NOT BY PARSING ACTIVITY`.
 */
import type { Prisma } from '@prisma/client'
import { EntryError } from './errors'

export type RegisterArrivalParams = {
  vehicleId: string
  /** `sellerLeadId` observado en la lectura preliminar; detecta que la raíz cambió. */
  resolvedSellerLeadId: string | null
  actorId: string
}

export type RegisterArrivalHooks = {
  /** Sincronización determinista para tests de concurrencia (antes de la escritura). */
  beforeWrite?: () => Promise<void>
}

/**
 * Registra la llegada física dentro de la transacción abierta por `withLockedRoots`. Debe invocarse
 * DENTRO de `withLockedRoots(buildEntryRoots(...), ...)`. Idempotente.
 *
 * @returns `alreadyRegistered=true` cuando la llegada ya estaba registrada (no-op).
 */
export async function registerPhysicalArrivalTx(
  tx: Prisma.TransactionClient,
  p: RegisterArrivalParams,
  hooks: RegisterArrivalHooks = {}
): Promise<{ vehicleId: string; alreadyRegistered: boolean }> {
  // (1) Relectura del vehículo + consistencia de raíz.
  const vehicle = await tx.vehicle.findUnique({
    where: { id: p.vehicleId },
    select: { sellerLeadId: true, physicalArrivalAt: true, entryAnnulledAt: true },
  })
  if (!vehicle) throw new EntryError('VEHICLE_NOT_FOUND')
  if (vehicle.sellerLeadId !== p.resolvedSellerLeadId) {
    throw new EntryError('VEHICLE_ROOT_CHANGED')
  }

  // (2) Vendedor: existe y no archivado.
  const seller = await tx.sellerLead.findUnique({
    where: { id: vehicle.sellerLeadId },
    select: { archivedAt: true },
  })
  if (!seller) throw new EntryError('SELLER_LEAD_NOT_FOUND')
  if (seller.archivedAt != null) throw new EntryError('LEAD_ARCHIVED')

  // (3) Idempotencia: si la llegada ya está registrada, no-op. (Una entrada anulada implica que la
  // llegada ya se registró antes de validar, así que este caso también cae aquí.)
  if (vehicle.physicalArrivalAt != null) {
    return { vehicleId: p.vehicleId, alreadyRegistered: true }
  }

  await hooks.beforeWrite?.()

  // (4) CAS sobre `physicalArrivalAt IS NULL` — segunda barrera de idempotencia frente a carreras.
  const now = new Date()
  const cas = await tx.vehicle.updateMany({
    where: { id: p.vehicleId, physicalArrivalAt: null },
    data: { physicalArrivalAt: now, physicalArrivalById: p.actorId },
  })
  if (cas.count === 0) return { vehicleId: p.vehicleId, alreadyRegistered: true }

  // (5) Traza (NO fuente de verdad). El estado se lee de las columnas del vehículo.
  await tx.activity.create({
    data: {
      type: 'LLEGADA_REGISTRADA',
      content: 'Llegada física del vehículo a la nave registrada',
      agentId: p.actorId,
      sellerLeadId: vehicle.sellerLeadId,
    },
  })

  return { vehicleId: p.vehicleId, alreadyRegistered: false }
}
