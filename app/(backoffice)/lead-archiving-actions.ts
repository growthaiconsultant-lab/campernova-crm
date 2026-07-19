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
 *  - No cancela, completa ni reasigna ninguna dependencia: si hay operativa abierta, BLOQUEA y
 *    devuelve el detalle para que el operador la resuelva.
 *  - Idempotente y seguro ante concurrencia (compare-and-swap sobre `archivedAt`).
 *
 * LIMITACIÓN CONOCIDA: hasta PR C, los leads archivados SIGUEN APARECIENDO en bandejas y
 * búsqueda — este PR no toca consultas de listado.
 */

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { SELLER_LEAD_STATUS_LABELS, BUYER_LEAD_STATUS_LABELS } from '@/lib/state-machine'
import {
  ARCHIVE_REASON_LABELS,
  classifyBlockers,
  isValidArchiveReason,
  normalizeArchiveNotes,
  loadSellerArchiveDependencies,
  loadBuyerArchiveDependencies,
  type ArchiveOutcome,
  type ReactivateOutcome,
} from '@/lib/lead-archiving'

type LeadKind = 'seller' | 'buyer'

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

// ─── Archivar ─────────────────────────────────────────────────────────────────

async function archiveLead(
  kind: LeadKind,
  leadId: string,
  reason: unknown,
  notes?: string | null
): Promise<ArchiveOutcome> {
  const actor = await requireAgente()

  if (!leadId) return { status: 'error', message: 'Falta el identificador del lead' }
  if (!isValidArchiveReason(reason)) {
    return { status: 'error', message: 'Selecciona el motivo del archivado' }
  }
  const cleanNotes = normalizeArchiveNotes(notes)

  const lead =
    kind === 'seller'
      ? await db.sellerLead.findUnique({
          where: { id: leadId },
          select: { status: true, archivedAt: true },
        })
      : await db.buyerLead.findUnique({
          where: { id: leadId },
          select: { status: true, archivedAt: true },
        })

  if (!lead) return { status: 'error', message: 'No se ha encontrado el lead' }
  if (lead.archivedAt != null) return { status: 'already_archived' }

  // Dependencias activas → se bloquea SIN escribir nada. No se gestiona ninguna automáticamente.
  const deps =
    kind === 'seller'
      ? await loadSellerArchiveDependencies(db, leadId)
      : await loadBuyerArchiveDependencies(db, leadId)
  const blockers = classifyBlockers(deps)
  if (blockers.length > 0) {
    return { status: 'blocked', code: 'ARCHIVE_BLOCKED', blockers }
  }

  const now = new Date()
  const data = {
    archivedAt: now,
    archivedById: actor.id,
    archiveReason: reason,
    archiveNotes: cleanNotes,
  }
  const content =
    `Lead archivado · Motivo: ${ARCHIVE_REASON_LABELS[reason]}` +
    (cleanNotes ? ` — ${cleanNotes}` : '') +
    ` · Estado comercial: ${statusLabel(kind, lead.status)} (sin cambios)` +
    ' · Archivado: no → sí'

  const applied = await db.$transaction(async (tx) => {
    // Compare-and-swap: solo archiva si sigue activo. Evita doble escritura y doble Activity
    // si dos peticiones concurrentes intentan archivar el mismo lead.
    const res =
      kind === 'seller'
        ? await tx.sellerLead.updateMany({ where: { id: leadId, archivedAt: null }, data })
        : await tx.buyerLead.updateMany({ where: { id: leadId, archivedAt: null }, data })
    if (res.count === 0) return false

    await tx.activity.create({
      data: {
        type: 'LEAD_ARCHIVADO',
        content,
        agentId: actor.id,
        ...(kind === 'seller' ? { sellerLeadId: leadId } : { buyerLeadId: leadId }),
      } as Prisma.ActivityUncheckedCreateInput,
    })
    return true
  })

  if (!applied) return { status: 'already_archived' }

  revalidateFor(kind, leadId)
  return { status: 'archived' }
}

// ─── Reactivar ────────────────────────────────────────────────────────────────

async function reactivateLead(kind: LeadKind, leadId: string): Promise<ReactivateOutcome> {
  const actor = await requireAgente()
  if (!leadId) return { status: 'error', message: 'Falta el identificador del lead' }

  const lead =
    kind === 'seller'
      ? await db.sellerLead.findUnique({
          where: { id: leadId },
          select: { status: true, archivedAt: true, archiveReason: true },
        })
      : await db.buyerLead.findUnique({
          where: { id: leadId },
          select: { status: true, archivedAt: true, archiveReason: true },
        })

  if (!lead) return { status: 'error', message: 'No se ha encontrado el lead' }
  if (lead.archivedAt == null) return { status: 'already_active' }

  const previousReason = lead.archiveReason
  const content =
    'Lead reactivado' +
    ` · Estado comercial: ${statusLabel(kind, lead.status)} (sin cambios)` +
    ' · Archivado: sí → no' +
    (previousReason
      ? ` · Motivo de archivado previo: ${ARCHIVE_REASON_LABELS[previousReason]}`
      : '')

  // Solo se retira la condición de archivado. Nada más se toca (tareas, eventos, ofertas,
  // entregas, vehículo, agente, documentos y KPIs quedan como estaban).
  const data = {
    archivedAt: null,
    archivedById: null,
    archiveReason: null,
    archiveNotes: null,
  }

  const applied = await db.$transaction(async (tx) => {
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
    if (res.count === 0) return false

    await tx.activity.create({
      data: {
        type: 'LEAD_REACTIVADO',
        content,
        agentId: actor.id,
        ...(kind === 'seller' ? { sellerLeadId: leadId } : { buyerLeadId: leadId }),
      } as Prisma.ActivityUncheckedCreateInput,
    })
    return true
  })

  if (!applied) return { status: 'already_active' }

  revalidateFor(kind, leadId)
  return { status: 'reactivated' }
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
