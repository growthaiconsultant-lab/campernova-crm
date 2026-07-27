/**
 * PR-A2 — Anulación de la entrada oficial (núcleo transaccional).
 *
 * La anulación es TERMINAL en la v1: no se limpia ni se revalida. Requiere una entrada activa
 * (`entryValidatedAt != null AND entryAnnulledAt == null`), un motivo estructurado y, cuando el
 * motivo es `OTRO`, notas obligatorias. Corre bajo el mismo protocolo de root locks + CAS que la
 * validación (`Vehicle → SellerLead`).
 *
 * `ANNULMENT IS TERMINAL — NO RE-VALIDATION PATH IN V1`.
 * `ENTRY STATE IS READ FROM THE VEHICLE COLUMNS, NOT BY PARSING ACTIVITY`.
 */
import type { Prisma, EntryAnnulmentReason } from '@prisma/client'
import { EntryError } from './errors'
import { ACTIVE_WORKORDER_STATUSES } from './validate'

export type AnnulEntryParams = {
  vehicleId: string
  /** `sellerLeadId` observado en la lectura preliminar; detecta que la raíz cambió. */
  resolvedSellerLeadId: string | null
  actorId: string
  reason: EntryAnnulmentReason
  /** Obligatorias cuando `reason === 'OTRO'`. */
  notes: string | null
}

export type AnnulEntryHooks = {
  /** Sincronización determinista para tests de concurrencia (antes de la escritura). */
  beforeWrite?: () => Promise<void>
}

/**
 * Anula la entrada oficial dentro de la transacción abierta por `withLockedRoots`. Debe invocarse
 * DENTRO de `withLockedRoots(buildEntryRoots(...), ...)`.
 */
export async function annulEntryTx(
  tx: Prisma.TransactionClient,
  p: AnnulEntryParams,
  hooks: AnnulEntryHooks = {}
): Promise<{ vehicleId: string; inspectionOrdersClosed: number }> {
  // Notas obligatorias cuando el motivo es OTRO (se valida también en el server action; aquí es la
  // barrera de dominio definitiva, bajo el lock).
  if (p.reason === 'OTRO' && (p.notes == null || p.notes.trim().length === 0)) {
    throw new EntryError('ANNULMENT_NOTES_REQUIRED')
  }

  // (1) Relectura del vehículo + consistencia de raíz.
  const vehicle = await tx.vehicle.findUnique({
    where: { id: p.vehicleId },
    select: { sellerLeadId: true, entryValidatedAt: true, entryAnnulledAt: true },
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

  // (3) Debe haber una entrada activa para anular.
  if (vehicle.entryValidatedAt == null || vehicle.entryAnnulledAt != null) {
    throw new EntryError('ENTRY_NOT_ACTIVE')
  }

  await hooks.beforeWrite?.()

  // (4) CAS: solo anula si la entrada sigue activa (validada y no anulada).
  const now = new Date()
  const cas = await tx.vehicle.updateMany({
    where: { id: p.vehicleId, entryValidatedAt: { not: null }, entryAnnulledAt: null },
    data: {
      entryAnnulledAt: now,
      entryAnnulledById: p.actorId,
      entryAnnulmentReason: p.reason,
      entryAnnulmentNotes: p.notes?.trim() ? p.notes.trim() : null,
    },
  })
  if (cas.count === 0) throw new EntryError('ENTRY_NOT_ACTIVE')

  // (5) Cierre de la orden de inspección de entrada (corrección 7.2): una entrada anulada NO debe
  // dejar una inspección activa colgando en Taller. Se marca RECHAZADA (estado terminal) bajo el
  // mismo lock/CAS. `AT MOST ONE ACTIVE INSPECTION PER VEHICLE` → como mucho una fila afectada.
  const closed = await tx.workOrder.updateMany({
    where: {
      vehicleId: p.vehicleId,
      kind: 'INSPECCION_ENTRADA',
      status: { in: [...ACTIVE_WORKORDER_STATUSES] },
    },
    data: { status: 'RECHAZADA' },
  })

  // (6) Traza (NO fuente de verdad).
  await tx.activity.create({
    data: {
      type: 'ENTRADA_ANULADA',
      content: `Entrada oficial anulada · motivo: ${p.reason}`,
      agentId: p.actorId,
      sellerLeadId: vehicle.sellerLeadId,
    },
  })
  if (closed.count > 0) {
    await tx.activity.create({
      data: {
        type: 'ORDEN_TALLER_RECHAZADA',
        content: 'Orden de inspección de entrada rechazada por anulación de la entrada',
        agentId: p.actorId,
        sellerLeadId: vehicle.sellerLeadId,
      },
    })
  }

  return { vehicleId: p.vehicleId, inspectionOrdersClosed: closed.count }
}
