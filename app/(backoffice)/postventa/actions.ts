'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, requireCanViewPostventa, requireCanEditPostventa } from '@/lib/auth'
import { imputeTicketCost, extendWarranty as extendWarrantyLib } from '@/lib/postventa'
import { sendTicketOpenedNotification } from '@/lib/email/send'
import type { TicketStatus, TicketPriority } from '@prisma/client'

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const VALID_TICKET_TRANSITIONS: Partial<Record<TicketStatus, TicketStatus[]>> = {
  ABIERTO: ['EN_PROGRESO', 'ANULADO'],
  EN_PROGRESO: ['RESUELTO', 'ANULADO'],
  RESUELTO: ['CERRADO', 'EN_PROGRESO'],
}

function isValidTicketTransition(from: TicketStatus, to: TicketStatus) {
  return VALID_TICKET_TRANSITIONS[from]?.includes(to) ?? false
}

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

  // Notify admins for HIGH/CRITICAL tickets
  if (priority === 'ALTA' || priority === 'CRITICA') {
    const admins = await db.user.findMany({
      where: { role: { in: ['ADMIN', 'ENTREGAS'] }, active: true },
      select: { email: true },
    })
    sendTicketOpenedNotification({
      adminEmails: admins.map((a) => a.email),
      ticketTitle: title,
      priority,
      ticketId: ticket.id,
    }).catch(console.error)
  }

  revalidatePostventa(ticket.id)
  return { ok: true, data: { id: ticket.id } }
}

export async function updateTicket(ticketId: string, formData: unknown): Promise<ActionResult> {
  await requireCanEditPostventa()

  const parsed = updateTicketSchema.safeParse(formData)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  const { dueAt, costEstimate, costReal, ...rest } = parsed.data

  await db.postventaTicket.update({
    where: { id: ticketId },
    data: {
      ...rest,
      dueAt: dueAt !== undefined ? (dueAt ? new Date(dueAt) : null) : undefined,
      costEstimate: costEstimate ?? undefined,
      costReal: costReal ?? undefined,
    },
  })

  revalidatePostventa(ticketId)
  return { ok: true }
}

export async function changeTicketStatus(
  ticketId: string,
  newStatus: TicketStatus
): Promise<ActionResult> {
  const actor = await requireCanEditPostventa()

  const ticket = await db.postventaTicket.findUnique({
    where: { id: ticketId },
    select: {
      status: true,
      costReal: true,
      warranty: { select: { buyerLeadId: true } },
    },
  })
  if (!ticket) return { ok: false, error: 'Ticket no encontrado' }

  if (!isValidTicketTransition(ticket.status, newStatus)) {
    return { ok: false, error: `Transición ${ticket.status} → ${newStatus} no permitida.` }
  }

  const now = new Date()
  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'RESUELTO') updateData.resolvedAt = now
  if (newStatus === 'CERRADO') updateData.closedAt = now

  await db.postventaTicket.update({ where: { id: ticketId }, data: updateData })

  const activityType =
    newStatus === 'RESUELTO'
      ? 'TICKET_POSTVENTA_RESUELTO'
      : newStatus === 'CERRADO'
        ? 'TICKET_POSTVENTA_CERRADO'
        : 'CAMBIO_ESTADO'

  await db.activity.create({
    data: {
      type: activityType,
      content: `Ticket: ${ticket.status} → ${newStatus}`,
      agentId: actor.id,
      buyerLeadId: ticket.warranty.buyerLeadId,
    },
  })

  if (newStatus === 'CERRADO') {
    await imputeTicketCost(ticketId, actor.id, db)
    revalidatePath('/vendedores') // margin may have changed
  }

  revalidatePostventa(ticketId)
  return { ok: true }
}

export async function setTicketCost(
  ticketId: string,
  data: { costEstimate?: number | null; costReal?: number | null }
): Promise<ActionResult> {
  await requireCanEditPostventa()

  await db.postventaTicket.update({
    where: { id: ticketId },
    data: {
      costEstimate: data.costEstimate ?? undefined,
      costReal: data.costReal ?? undefined,
    },
  })

  revalidatePostventa(ticketId)
  return { ok: true }
}

export async function uploadTicketPhoto(
  ticketId: string,
  data: { type: 'PROBLEMA' | 'SOLUCION'; url: string }
): Promise<ActionResult> {
  const actor = await requireCanEditPostventa()

  await db.postventaTicketPhoto.create({
    data: { ticketId, type: data.type, url: data.url, uploadedById: actor.id },
  })

  revalidatePostventa(ticketId)
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
