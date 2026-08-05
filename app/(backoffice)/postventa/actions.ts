'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Prisma, TicketPriority, TicketStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin, requireCanEditPostventa, requireCanViewPostventa } from '@/lib/auth'
import { sendTicketOpenedNotification } from '@/lib/email/send'
import { isLockError, withLockedRoots, type LockRoot } from '@/lib/locking'
import { extendWarranty as extendWarrantyLib } from '@/lib/postventa'
import {
  isTicketTransitionError,
  TICKET_TRANSITION_ERROR_MESSAGES,
  transitionTicketTx,
} from '@/lib/postventa/transition-ticket'
import {
  TICKET_CORRECTION_TARGET,
  TICKET_FORWARD_TRANSITIONS,
  type TicketTransitionKind,
} from '@/lib/postventa/transitions'

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

function revalidatePostventa(id?: string) {
  revalidatePath('/postventa')
  if (id) revalidatePath(`/postventa/${id}`)
}

const createTicketSchema = z.object({
  warrantyId: z.string().min(1),
  title: z.string().min(1, 'Título requerido').trim(),
  description: z.string().min(1, 'Descripción requerida').trim(),
  priority: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).default('MEDIA'),
  dueAt: z.string().optional().nullable(),
})

const updateTicketSchema = z.object({
  title: z.string().min(1).trim().optional(),
  description: z.string().min(1).trim().optional(),
  cause: z.string().trim().optional().nullable(),
  solution: z.string().trim().optional().nullable(),
  priority: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
  dueAt: z.string().optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  costEstimate: z.coerce.number().positive().optional().nullable(),
  costReal: z.coerce.number().positive().optional().nullable(),
})

const correctionReasonSchema = z
  .string()
  .trim()
  .min(3, 'Indica un motivo de al menos 3 caracteres.')
  .max(500, 'El motivo no puede superar 500 caracteres.')

const ticketCostSchema = z.object({
  costEstimate: z.coerce.number().positive().optional().nullable(),
  costReal: z.coerce.number().positive().optional().nullable(),
})

const ticketPhotoSchema = z.object({
  type: z.enum(['PROBLEMA', 'SOLUCION']),
  url: z.string().url(),
})

type ResolvedTicket = {
  status: TicketStatus
  warrantyId: string
  vehicleId: string
  buyerLeadId: string
}

async function resolveTicket(ticketId: string): Promise<ResolvedTicket | null> {
  const ticket = await db.postventaTicket.findUnique({
    where: { id: ticketId },
    select: {
      status: true,
      warrantyId: true,
      warranty: { select: { vehicleId: true, buyerLeadId: true } },
    },
  })
  if (!ticket) return null
  return {
    status: ticket.status,
    warrantyId: ticket.warrantyId,
    vehicleId: ticket.warranty.vehicleId,
    buyerLeadId: ticket.warranty.buyerLeadId,
  }
}

function ticketRoots(ticket: ResolvedTicket): LockRoot[] {
  return [
    { type: 'vehicle', id: ticket.vehicleId },
    { type: 'buyerLead', id: ticket.buyerLeadId },
  ]
}

async function withOpenTicket<T>(
  ticketId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<ActionResult<T>> {
  const resolved = await resolveTicket(ticketId)
  if (!resolved) return { ok: false, error: 'Ticket no encontrado.' }

  try {
    const data = await withLockedRoots(ticketRoots(resolved), async (tx) => {
      const current = await tx.postventaTicket.findUnique({
        where: { id: ticketId },
        select: { status: true },
      })
      if (!current) throw new Error('TICKET_NOT_FOUND')
      if (current.status === 'CERRADO' || current.status === 'ANULADO') {
        throw new Error('TICKET_CLOSED')
      }
      return operation(tx)
    })
    revalidatePostventa(resolved.warrantyId)
    return { ok: true, data }
  } catch (error) {
    if (isLockError(error)) return { ok: false, error: error.message }
    if (error instanceof Error && error.message === 'TICKET_NOT_FOUND') {
      return { ok: false, error: 'Ticket no encontrado.' }
    }
    if (error instanceof Error && error.message === 'TICKET_CLOSED') {
      return { ok: false, error: 'Reabre el ticket antes de modificarlo.' }
    }
    throw error
  }
}

async function runTicketTransition(params: {
  ticketId: string
  expectedCurrentStatus?: TicketStatus
  target: TicketStatus
  kind: TicketTransitionKind
  actorId: string
  reason?: string
}): Promise<ActionResult> {
  const resolved = await resolveTicket(params.ticketId)
  if (!resolved) return { ok: false, error: 'Ticket no encontrado.' }

  try {
    const result = await withLockedRoots(ticketRoots(resolved), (tx) =>
      transitionTicketTx(tx, {
        ...params,
        expectedCurrentStatus: params.expectedCurrentStatus ?? resolved.status,
      })
    )
    revalidatePostventa(result.warrantyId)
    revalidatePath(`/vendedores/${result.sellerLeadId}`)
    revalidatePath(`/compradores/${result.buyerLeadId}`)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (error) {
    if (isLockError(error)) return { ok: false, error: error.message }
    if (isTicketTransitionError(error)) {
      return { ok: false, error: TICKET_TRANSITION_ERROR_MESSAGES[error.code] }
    }
    throw error
  }
}

export async function createTicket(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await requireCanViewPostventa()
  const parsed = createTicketSchema.safeParse(formData)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  const { warrantyId, title, description, priority, dueAt } = parsed.data
  const warranty = await db.warranty.findUnique({
    where: { id: warrantyId },
    select: { vehicleId: true, buyerLeadId: true },
  })
  if (!warranty) return { ok: false, error: 'Garantía no encontrada' }

  const ticket = await db.postventaTicket.create({
    data: {
      warrantyId,
      title,
      description,
      priority: priority as TicketPriority,
      dueAt: dueAt ? new Date(dueAt) : null,
    },
  })
  await db.activity.create({
    data: {
      type: 'TICKET_POSTVENTA_ABIERTO',
      content: `Ticket abierto: "${title}" (prioridad ${priority})`,
      agentId: actor.id,
      buyerLeadId: warranty.buyerLeadId,
    },
  })

  if (priority === 'ALTA' || priority === 'CRITICA') {
    const admins = await db.user.findMany({
      where: { role: { in: ['ADMIN', 'ENTREGAS'] }, active: true },
      select: { email: true },
    })
    sendTicketOpenedNotification({
      adminEmails: admins.map((admin) => admin.email),
      ticketTitle: title,
      priority,
      ticketId: ticket.id,
    }).catch(console.error)
  }

  revalidatePostventa(warrantyId)
  return { ok: true, data: { id: ticket.id } }
}

export async function updateTicket(ticketId: string, formData: unknown): Promise<ActionResult> {
  await requireCanEditPostventa()
  const parsed = updateTicketSchema.safeParse(formData)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  const { dueAt, costEstimate, costReal, ...rest } = parsed.data
  const result = await withOpenTicket(ticketId, (tx) =>
    tx.postventaTicket.update({
      where: { id: ticketId },
      data: {
        ...rest,
        dueAt: dueAt !== undefined ? (dueAt ? new Date(dueAt) : null) : undefined,
        costEstimate: costEstimate === null ? null : costEstimate,
        costReal: costReal === null ? null : costReal,
      },
    })
  )
  if (!result.ok) return result

  return { ok: true }
}

export async function changeTicketStatus(
  ticketId: string,
  newStatus: TicketStatus,
  reason?: string
): Promise<ActionResult> {
  const actor = await requireCanEditPostventa()
  const current = await resolveTicket(ticketId)
  if (!current) return { ok: false, error: 'Ticket no encontrado.' }

  const kind: TicketTransitionKind =
    TICKET_CORRECTION_TARGET[current.status] === newStatus ? 'correction' : 'forward'
  if (kind === 'correction') {
    const parsedReason = correctionReasonSchema.safeParse(reason)
    if (!parsedReason.success) return { ok: false, error: parsedReason.error.issues[0].message }
    reason = parsedReason.data
  } else if (!(TICKET_FORWARD_TRANSITIONS[current.status]?.includes(newStatus) ?? false)) {
    return { ok: false, error: 'La transición de estado no está permitida.' }
  }

  return runTicketTransition({
    ticketId,
    expectedCurrentStatus: current.status,
    target: newStatus,
    kind,
    actorId: actor.id,
    reason,
  })
}

export async function reopenTicket(
  ticketId: string,
  newStatus: TicketStatus,
  reason: string
): Promise<ActionResult> {
  const actor = await requireAdmin()
  const parsedReason = correctionReasonSchema.safeParse(reason)
  if (!parsedReason.success) return { ok: false, error: parsedReason.error.issues[0].message }
  return runTicketTransition({
    ticketId,
    target: newStatus,
    kind: 'reopen',
    actorId: actor.id,
    reason: parsedReason.data,
  })
}

export async function setTicketCost(
  ticketId: string,
  data: { costEstimate?: number | null; costReal?: number | null }
): Promise<ActionResult> {
  await requireCanEditPostventa()
  const parsed = ticketCostSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: 'Costes inválidos.' }
  const result = await withOpenTicket(ticketId, (tx) =>
    tx.postventaTicket.update({
      where: { id: ticketId },
      data: {
        costEstimate: parsed.data.costEstimate === null ? null : parsed.data.costEstimate,
        costReal: parsed.data.costReal === null ? null : parsed.data.costReal,
      },
    })
  )
  if (!result.ok) return result

  return { ok: true }
}

export async function uploadTicketPhoto(
  ticketId: string,
  data: { type: 'PROBLEMA' | 'SOLUCION'; url: string }
): Promise<ActionResult> {
  const actor = await requireCanEditPostventa()
  const parsed = ticketPhotoSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: 'Foto inválida.' }
  const result = await withOpenTicket(ticketId, (tx) =>
    tx.postventaTicketPhoto.create({
      data: {
        ticketId,
        type: parsed.data.type,
        url: parsed.data.url,
        uploadedById: actor.id,
      },
    })
  )
  if (!result.ok) return result

  return { ok: true }
}

export async function extendWarranty(
  warrantyId: string,
  additionalMonths: number
): Promise<ActionResult> {
  const actor = await requireAdmin()
  const warranty = await db.warranty.findUnique({
    where: { id: warrantyId },
    select: { buyerLeadId: true },
  })
  if (!warranty) return { ok: false, error: 'Garantía no encontrada' }

  await extendWarrantyLib(warrantyId, additionalMonths, actor.id, db)
  await db.activity.create({
    data: {
      type: 'GARANTIA_AMPLIADA',
      content: `Garantía ampliada ${additionalMonths} meses por ${actor.name}.`,
      agentId: actor.id,
      buyerLeadId: warranty.buyerLeadId,
    },
  })

  revalidatePath('/postventa')
  revalidatePath('/vendedores')
  return { ok: true }
}
