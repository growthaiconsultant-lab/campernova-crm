'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAgente } from '@/lib/auth'
import { isLockError, withLockedRoots } from '@/lib/locking'
import { resolveCommitment } from '@/lib/calendar/commitment'

const schema = z
  .object({
    requestId: z.string().uuid(),
    outcome: z.string().trim().min(1).max(2000).nullable(),
    next: z
      .object({ title: z.string().trim().min(1).max(160), startAt: z.string().datetime() })
      .nullable(),
    // Snapshot of the legacy call reminder the agent explicitly chose to finish.
    finishReminder: z.object({ dueAt: z.string().datetime().nullable() }).nullable(),
  })
  .refine((x) => (x.next || x.outcome) && (!x.finishReminder || x.outcome))

export async function saveSellerFollowup(sellerLeadId: string, input: unknown) {
  const actor = await requireAgente()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { error: 'Revisa el resultado de la llamada y el siguiente paso.' }
  const { requestId, outcome, next, finishReminder } = parsed.data
  const key = createHash('sha256')
    .update(JSON.stringify(['seller', actor.id, sellerLeadId, requestId]))
    .digest('hex')
  const activityId = 'seller_followup_' + key
  const eventId = 'seller_step_' + key
  try {
    const result = await withLockedRoots([{ type: 'sellerLead', id: sellerLeadId }], async (tx) => {
      const previous = await tx.activity.findUnique({
        where: { id: activityId },
        select: { type: true, content: true },
      })
      const content = outcome ?? next!.title
      const type = outcome ? 'LLAMADA' : 'PROXIMA_ACCION_ACTUALIZADA'
      if (previous) {
        const event = await tx.calendarEvent.findUnique({
          where: { id: eventId },
          select: { title: true, startAt: true },
        })
        if (
          previous.type !== type ||
          previous.content !== content ||
          (event?.title ?? null) !== (next?.title ?? null) ||
          (event?.startAt.getTime() ?? null) !== (next ? Date.parse(next.startAt) : null)
        )
          return { error: 'Este seguimiento ya se guardó con otros datos. Revisa el historial.' }
        return { ok: true }
      }
      const lead = await tx.sellerLead.findUniqueOrThrow({
        where: { id: sellerLeadId },
        select: { agentId: true, archivedAt: true, intakeStatus: true },
      })
      if (lead.intakeStatus !== 'ADMITIDO')
        return { error: 'La solicitud debe estar admitida para registrar seguimiento.' }
      if (next && lead.archivedAt)
        return { error: 'Reactiva el vendedor antes de programar una acción.' }
      if (next && Date.parse(next.startAt) <= Date.now())
        return { error: 'Elige una fecha y hora futuras.' }
      if (finishReminder) {
        const changed = await tx.sellerLead.updateMany({
          where: {
            id: sellerLeadId,
            nextActionType: 'LLAMAR',
            nextActionDueAt: finishReminder.dueAt ? new Date(finishReminder.dueAt) : null,
          },
          data: { nextActionType: null, nextActionDueAt: null },
        })
        if (!changed.count)
          return {
            error: 'El recordatorio ha cambiado. Actualiza la ficha antes de marcarlo como hecho.',
          }
      }
      await tx.activity.create({
        data: { id: activityId, sellerLeadId, agentId: actor.id, type, content },
      })
      if (next) {
        const commitment = resolveCommitment('OTRO', null)
        if (!commitment.ok) throw Error('Compromiso incompatible')
        await tx.calendarEvent.create({
          data: {
            id: eventId,
            sellerLeadId,
            createdById: actor.id,
            assignedToId: lead.agentId ?? actor.id,
            type: 'OTRO',
            commitment: commitment.value,
            title: next.title,
            startAt: new Date(next.startAt),
          },
        })
      }
      return { ok: true }
    })
    if ('error' in result) return { error: result.error }
  } catch (error) {
    if (isLockError(error) && error.code === 'ROOT_NOT_FOUND')
      return { error: 'Vendedor no encontrado.' }
    return {
      error: 'No se ha podido confirmar el guardado. Puedes reintentar con los mismos datos.',
    }
  }
  revalidatePath('/vendedores')
  revalidatePath('/vendedores/' + sellerLeadId)
  if (next) revalidatePath('/calendario')
  if (finishReminder) revalidatePath('/dashboard')
  return { ok: true, eventId: next ? eventId : undefined }
}
