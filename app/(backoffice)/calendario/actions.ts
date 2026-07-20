'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { createCalendarEventSchema } from '@/lib/validators/calendar-event'
import { isValidEventTransition, EVENT_TYPE_LABELS } from '@/lib/calendar/event-meta'
import { resolveCommitment, canReclassify } from '@/lib/calendar/commitment'
import { sendCalendarEventAssigned } from '@/lib/email/send'
import type { CalendarEventStatus, Prisma } from '@prisma/client'

/** F2: crea un evento de calendario (cita, limpieza, seguimiento, otro). */
export async function createCalendarEvent(data: unknown): Promise<{ error?: string; id?: string }> {
  const actor = await requireAgente()

  const parsed = createCalendarEventSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
  }
  const d = parsed.data

  // La clasificación se decide SIEMPRE en el servidor: el valor del cliente es una propuesta.
  const commitment = resolveCommitment(d.type, d.commitment ?? null)
  if (!commitment.ok) {
    return {
      error:
        commitment.reason === 'required'
          ? 'Indica si el evento es un compromiso acordado con el cliente o una tarea interna'
          : 'La clasificación no es compatible con el tipo de evento',
    }
  }

  const start = new Date(d.startAt)
  const endAt =
    d.durationMinutes != null ? new Date(start.getTime() + d.durationMinutes * 60000) : null

  const event = await db.calendarEvent.create({
    data: {
      type: d.type,
      commitment: commitment.value,
      title: d.title,
      description: d.description ?? null,
      priority: d.priority,
      startAt: start,
      endAt,
      durationMinutes: d.durationMinutes ?? null,
      location: d.location ?? null,
      createdById: actor.id,
      assignedToId: d.assignedToId || null,
      buyerLeadId: d.buyerLeadId || null,
      sellerLeadId: d.sellerLeadId || null,
      vehicleId: d.vehicleId || null,
      matchId: d.matchId || null,
      specificData: (d.specificData ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })

  // F6: aviso inmediato al responsable si se le asigna (y no es quien lo crea)
  if (d.assignedToId && d.assignedToId !== actor.id) {
    const assignee = await db.user.findUnique({
      where: { id: d.assignedToId },
      select: { name: true, email: true, active: true },
    })
    if (assignee?.active && assignee.email) {
      await sendCalendarEventAssigned({
        to: assignee.email,
        assigneeName: assignee.name,
        eventTitle: d.title,
        kindLabel: EVENT_TYPE_LABELS[d.type],
        whenLabel: start.toLocaleString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        }),
        contextLabel: null,
        href: `/calendario/${event.id}`,
      })
    }
  }

  revalidatePath('/calendario')
  if (d.buyerLeadId) revalidatePath(`/compradores/${d.buyerLeadId}`)
  if (d.sellerLeadId) revalidatePath(`/vendedores/${d.sellerLeadId}`)
  return { id: event.id }
}

/**
 * F2: cambia el estado de un evento (confirmar / iniciar / completar / cancelar / no-show).
 * Al completar guarda `resultNotes`; al cancelar/no-show guarda motivo.
 */
export async function updateCalendarEventStatus(
  id: string,
  status: string,
  extra?: { resultNotes?: string; cancellationReason?: string }
): Promise<{ error?: string }> {
  await requireAgente()

  const valid: CalendarEventStatus[] = [
    'PROGRAMADO',
    'CONFIRMADO',
    'EN_CURSO',
    'COMPLETADO',
    'CANCELADO',
    'NO_SHOW',
  ]
  if (!valid.includes(status as CalendarEventStatus)) return { error: 'Estado no válido' }
  const next = status as CalendarEventStatus

  const event = await db.calendarEvent.findUnique({
    where: { id },
    select: { status: true, buyerLeadId: true, sellerLeadId: true },
  })
  if (!event) return { error: 'Evento no encontrado' }
  if (!isValidEventTransition(event.status, next)) {
    return { error: 'Transición de estado no permitida' }
  }

  const now = new Date()
  await db.calendarEvent.update({
    where: { id },
    data: {
      status: next,
      ...(next === 'COMPLETADO'
        ? { completedAt: now, resultNotes: extra?.resultNotes?.trim().slice(0, 2000) || null }
        : {}),
      ...(next === 'CANCELADO' || next === 'NO_SHOW'
        ? {
            cancelledAt: now,
            cancellationReason: extra?.cancellationReason?.trim().slice(0, 500) || null,
          }
        : {}),
    },
  })

  revalidatePath('/calendario')
  revalidatePath(`/calendario/${id}`)
  if (event.buyerLeadId) revalidatePath(`/compradores/${event.buyerLeadId}`)
  if (event.sellerLeadId) revalidatePath(`/vendedores/${event.sellerLeadId}`)
  return {}
}

/**
 * I0: clasifica un evento como compromiso externo o tarea interna.
 *
 * Pensado para los eventos históricos que quedaron `INDETERMINADO` en la migración, cuya
 * semántica no era deducible del tipo. No permite devolver un evento a `INDETERMINADO`: ese
 * estado describe el origen del dato, no un destino elegible.
 */
export async function setEventCommitment(
  id: string,
  commitment: string
): Promise<{ error?: string }> {
  await requireAgente()

  const event = await db.calendarEvent.findUnique({
    where: { id },
    select: { type: true, buyerLeadId: true, sellerLeadId: true },
  })
  if (!event) return { error: 'Evento no encontrado' }

  const resolved = canReclassify(event.type, commitment as never)
  if (!resolved.ok) return { error: 'La clasificación no es compatible con el tipo de evento' }

  await db.calendarEvent.update({ where: { id }, data: { commitment: resolved.value } })

  revalidatePath('/calendario')
  revalidatePath(`/calendario/${id}`)
  if (event.buyerLeadId) revalidatePath(`/compradores/${event.buyerLeadId}`)
  if (event.sellerLeadId) revalidatePath(`/vendedores/${event.sellerLeadId}`)
  return {}
}
