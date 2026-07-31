'use server'

/**
 * Archivado real y reactivación de leads (PR B2) — backend únicamente.
 *
 * SEMÁNTICA: archivar es una decisión ORGANIZATIVA (sacar el lead de la operativa diaria) y es
 * REVERSIBLE. No se confunde con las decisiones COMERCIALES `discardSellerLead` (→ DESCARTADO) y
 * `markBuyerLeadLost` (→ PERDIDO), que son terminales y no se reutilizan aquí.
 *
 * GARANTÍAS
 *  - No cambia el estado comercial, ni `lostReason`, ni vehículo, ofertas, reservas, entregas,
 *    documentos o KPIs. Solo escribe los 4 campos de archivado + una Activity.
 *  - No cancela, completa ni reasigna ninguna dependencia. Bloquea por stock, ofertas/reservas y
 *    entregas activas; próximas acciones y eventos futuros se conservan y se anotan en la Activity.
 *  - **Integridad concurrente**: la lectura del lead y sus dependencias, la clasificación, el
 *    compare-and-swap y la Activity ocurren bajo el mismo root lock y dentro de una transacción.
 *    Así no se saltan por carrera los bloqueos de stock, ofertas/reservas o entregas activas.
 *
 * EFECTO CONOCIDO: Prisma actualiza `updatedAt` (`@updatedAt`) al archivar y al reactivar. Es
 * inevitable y aceptado; puede alterar el orden de las vistas que ordenan por `sort=updatedAt`.
 * No afecta a los KPIs históricos canónicos, que leen `Vehicle.status`/`Vehicle.soldAt`.
 *
 * LIMITACIÓN CONOCIDA: hasta PR C, los leads archivados SIGUEN APARECIENDO en bandejas y
 * búsqueda — este PR no toca consultas de listado.
 */

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { requireAgente } from '@/lib/auth'
import { withLockedRoots, isLockError, type LockRoot } from '@/lib/locking'
import { SELLER_LEAD_STATUS_LABELS, BUYER_LEAD_STATUS_LABELS } from '@/lib/state-machine'
import {
  ARCHIVE_REASON_LABELS,
  ARCHIVE_NOTES_MAX_LENGTH,
  classifyBlockers,
  isValidArchiveReason,
  validateArchiveNotes,
  loadSellerArchiveDependencies,
  loadBuyerArchiveDependencies,
  type ArchiveOutcome,
  type ReactivateOutcome,
} from '@/lib/lead-archiving'

type LeadKind = 'seller' | 'buyer'

/**
 * Raíz del protocolo de locks para archivar/reactivar UN lead. Bloquear la fila del propio lead
 * basta para serializar con los writers coordinados: `createOffer`, `updateOfferStatus`,
 * `createDelivery`, la transición/cancelación de Delivery, `updateVehicle` (I3B) y
 * `setNextAction`. Los blockers de seguridad se releen bajo el lock; tareas y eventos se conservan
 * como contexto informativo y los writers siguen rechazando nueva operativa sobre leads archivados.
 */
function leadRoot(kind: LeadKind, leadId: string): LockRoot[] {
  return [{ type: kind === 'seller' ? 'sellerLead' : 'buyerLead', id: leadId }]
}

function statusLabel(kind: LeadKind, status: string): string {
  const map = (kind === 'seller' ? SELLER_LEAD_STATUS_LABELS : BUYER_LEAD_STATUS_LABELS) as Record<
    string,
    string
  >
  return map[status] ?? status
}

function revalidateFor(kind: LeadKind, leadId: string) {
  if (kind === 'seller') {
    revalidatePath(`/vendedores/${leadId}`)
    revalidatePath('/vendedores')
  } else {
    revalidatePath(`/compradores/${leadId}`)
    revalidatePath('/compradores')
    revalidatePath('/compradores/pipeline')
  }
}

function activityData(
  kind: LeadKind,
  leadId: string,
  type: string,
  content: string,
  actorId: string
) {
  return {
    type,
    content,
    agentId: actorId,
    ...(kind === 'seller' ? { sellerLeadId: leadId } : { buyerLeadId: leadId }),
  } as Prisma.ActivityUncheckedCreateInput
}

// ─── Archivar ─────────────────────────────────────────────────────────────────

async function archiveLead(
  kind: LeadKind,
  leadId: string,
  reason: unknown,
  notes?: string | null
): Promise<ArchiveOutcome> {
  const actor = await requireAgente()

  // Validación de entrada: fuera de la transacción a propósito (no toca BD, no debe reintentarse).
  if (!leadId) return { status: 'error', message: 'Falta el identificador del lead' }
  if (!isValidArchiveReason(reason)) {
    return { status: 'error', message: 'Selecciona el motivo del archivado' }
  }
  const notesResult = validateArchiveNotes(notes)
  if (!notesResult.ok) {
    return {
      status: 'error',
      message: `Las notas no pueden superar los ${ARCHIVE_NOTES_MAX_LENGTH} caracteres`,
    }
  }
  const cleanNotes = notesResult.value

  let outcome: ArchiveOutcome
  try {
    // Protocolo de root locks: la fila del lead se bloquea (`FOR UPDATE`) ANTES del callback.
    // Dentro se relee el lead, se releen TODAS las dependencias, se clasifican los bloqueos, se
    // hace el CAS y se escribe la Activity — todo BAJO el lock y en la misma transacción. La
    // lectura preliminar (permiso/validación de entrada) no decide negocio.
    outcome = await withLockedRoots(leadRoot(kind, leadId), async (tx) => {
      const lead =
        kind === 'seller'
          ? await tx.sellerLead.findUnique({
              where: { id: leadId },
              select: { status: true, archivedAt: true },
            })
          : await tx.buyerLead.findUnique({
              where: { id: leadId },
              select: { status: true, archivedAt: true },
            })
      // El lock ya garantizó que la fila existe; el guard satisface el tipo.
      if (!lead) return { status: 'error', message: 'No se ha encontrado el lead' }
      if (lead.archivedAt != null) return { status: 'already_archived' }

      const deps =
        kind === 'seller'
          ? await loadSellerArchiveDependencies(tx, leadId)
          : await loadBuyerArchiveDependencies(tx, leadId)
      const blockers = classifyBlockers(deps)
      if (blockers.length > 0) return { status: 'blocked', code: 'ARCHIVE_BLOCKED', blockers }

      const res =
        kind === 'seller'
          ? await tx.sellerLead.updateMany({
              where: { id: leadId, archivedAt: null },
              data: {
                archivedAt: new Date(),
                archivedById: actor.id,
                archiveReason: reason,
                archiveNotes: cleanNotes,
              },
            })
          : await tx.buyerLead.updateMany({
              where: { id: leadId, archivedAt: null },
              data: {
                archivedAt: new Date(),
                archivedById: actor.id,
                archiveReason: reason,
                archiveNotes: cleanNotes,
              },
            })
      if (res.count === 0) return { status: 'already_archived' }

      const content =
        `Lead archivado · Motivo: ${ARCHIVE_REASON_LABELS[reason]}` +
        (cleanNotes ? ` — ${cleanNotes}` : '') +
        ` · Estado comercial: ${statusLabel(kind, lead.status)} (sin cambios)` +
        ' · Archivado: no → sí' +
        (deps.hasPendingNextAction ? ' · Conserva próxima acción pendiente' : '') +
        (deps.futureEventCount > 0
          ? ` · Conserva ${deps.futureEventCount} evento${deps.futureEventCount === 1 ? '' : 's'} futuro${deps.futureEventCount === 1 ? '' : 's'}`
          : '')
      await tx.activity.create({
        data: activityData(kind, leadId, 'LEAD_ARCHIVADO', content, actor.id),
      })

      return { status: 'archived' }
    })
  } catch (err) {
    if (isLockError(err)) {
      if (err.code === 'ROOT_NOT_FOUND') {
        return { status: 'error', message: 'No se ha encontrado el lead' }
      }
      return {
        status: 'error',
        message: 'No se ha podido archivar por un conflicto de concurrencia. Inténtalo de nuevo.',
      }
    }
    throw err
  }

  // Revalidar SOLO tras una mutación real y siempre fuera de la transacción.
  if (outcome.status === 'archived') revalidateFor(kind, leadId)
  return outcome
}

// ─── Reactivar ────────────────────────────────────────────────────────────────

async function reactivateLead(kind: LeadKind, leadId: string): Promise<ReactivateOutcome> {
  const actor = await requireAgente()
  if (!leadId) return { status: 'error', message: 'Falta el identificador del lead' }

  let outcome: ReactivateOutcome
  try {
    // Mismo protocolo de root locks. Reactivar solo retira la condición de archivado; no evalúa
    // bloqueos (des-archivar nunca crea operativa) ni toca estado comercial ni relaciones.
    outcome = await withLockedRoots(leadRoot(kind, leadId), async (tx) => {
      const lead =
        kind === 'seller'
          ? await tx.sellerLead.findUnique({
              where: { id: leadId },
              select: { status: true, archivedAt: true, archiveReason: true },
            })
          : await tx.buyerLead.findUnique({
              where: { id: leadId },
              select: { status: true, archivedAt: true, archiveReason: true },
            })
      if (!lead) return { status: 'error', message: 'No se ha encontrado el lead' }
      if (lead.archivedAt == null) return { status: 'already_active' }

      // Solo se retira la condición de archivado. Nada más se toca (tareas, eventos, ofertas,
      // entregas, vehículo, agente, documentos y KPIs quedan como estaban).
      const data = {
        archivedAt: null,
        archivedById: null,
        archiveReason: null,
        archiveNotes: null,
      }
      const res =
        kind === 'seller'
          ? await tx.sellerLead.updateMany({
              where: { id: leadId, archivedAt: { not: null } },
              data,
            })
          : await tx.buyerLead.updateMany({
              where: { id: leadId, archivedAt: { not: null } },
              data,
            })
      if (res.count === 0) return { status: 'already_active' }

      const previousReason = lead.archiveReason
      const content =
        'Lead reactivado' +
        ` · Estado comercial: ${statusLabel(kind, lead.status)} (sin cambios)` +
        ' · Archivado: sí → no' +
        (previousReason
          ? ` · Motivo de archivado previo: ${ARCHIVE_REASON_LABELS[previousReason]}`
          : '')
      await tx.activity.create({
        data: activityData(kind, leadId, 'LEAD_REACTIVADO', content, actor.id),
      })

      return { status: 'reactivated' }
    })
  } catch (err) {
    if (isLockError(err)) {
      if (err.code === 'ROOT_NOT_FOUND') {
        return { status: 'error', message: 'No se ha encontrado el lead' }
      }
      return {
        status: 'error',
        message: 'No se ha podido reactivar por un conflicto de concurrencia. Inténtalo de nuevo.',
      }
    }
    throw err
  }

  if (outcome.status === 'reactivated') revalidateFor(kind, leadId)
  return outcome
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function archiveSellerLead(
  leadId: string,
  reason: unknown,
  notes?: string | null
): Promise<ArchiveOutcome> {
  return archiveLead('seller', leadId, reason, notes)
}

export async function reactivateSellerLead(leadId: string): Promise<ReactivateOutcome> {
  return reactivateLead('seller', leadId)
}

export async function archiveBuyerLead(
  leadId: string,
  reason: unknown,
  notes?: string | null
): Promise<ArchiveOutcome> {
  return archiveLead('buyer', leadId, reason, notes)
}

export async function reactivateBuyerLead(leadId: string): Promise<ReactivateOutcome> {
  return reactivateLead('buyer', leadId)
}
