'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAgente } from '@/lib/auth'
import { BUYER_ACTION_OPTIONS } from '@/lib/buyer-followup'
import { resolveCommitment } from '@/lib/calendar/commitment'
import { isLockError, withLockedRoots } from '@/lib/locking'

const callSchema = z.object({
  requestId: z.string().uuid(),
  outcome: z.string().trim().min(1, 'Escribe qué ha pasado en la llamada.').max(2000),
  next: z.object({ action: z.string(), startAt: z.string().datetime() }).nullable(),
})

export async function registerBuyerCall(buyerLeadId: string, input: unknown) {
  const actor = await requireAgente()
  const parsed = callSchema.safeParse(input)
  if (!parsed.success)
    return { error: 'Revisa el resultado de la llamada y la fecha del siguiente paso.' }
  const { requestId, outcome, next } = parsed.data
  const option = BUYER_ACTION_OPTIONS.find((o) => o.value === next?.action && o.value !== 'OTRO')
  if (next && !option) return { error: 'Selecciona un siguiente paso válido.' }
  const startAt = next ? new Date(next.startAt) : null
  const key = createHash('sha256')
    .update(JSON.stringify([actor.id, buyerLeadId, requestId]))
    .digest('hex')
  const activityId = 'buyer_call_' + key
  const eventId = 'call_step_' + key

  try {
    const result = await withLockedRoots([{ type: 'buyerLead', id: buyerLeadId }], async (tx) => {
      const previous = await tx.activity.findUnique({
        where: { id: activityId },
        select: { content: true },
      })
      if (previous) {
        const event = await tx.calendarEvent.findUnique({
          where: { id: eventId },
          select: { title: true, startAt: true },
        })
        if (
          previous.content !== outcome ||
          (event?.title ?? null) !== (option?.label ?? null) ||
          (event?.startAt.getTime() ?? null) !== (startAt?.getTime() ?? null)
        ) {
          return {
            error:
              'Esta llamada ya se guardó con otros datos. Revisa la actividad antes de registrar otra.',
          }
        }
        return { ok: true }
      }
      const buyer = await tx.buyerLead.findUniqueOrThrow({
        where: { id: buyerLeadId },
        select: { mergedIntoId: true, archivedAt: true },
      })
      if (buyer.mergedIntoId)
        return {
          error: 'Se ha unificado este comprador. Recarga la ficha antes de registrar la llamada.',
        }
      if (startAt && buyer.archivedAt)
        return { error: 'Reactiva el comprador antes de programar un siguiente paso.' }
      if (startAt && startAt.getTime() <= Date.now())
        return { error: 'Elige una fecha y hora futuras.' }

      await tx.activity.create({
        data: { id: activityId, buyerLeadId, agentId: actor.id, type: 'LLAMADA', content: outcome },
      })
      if (option && startAt) {
        const commitment = resolveCommitment(option.eventType, null)
        if (!commitment.ok) throw new Error('Clasificación de evento incompatible')
        await tx.calendarEvent.create({
          data: {
            id: eventId,
            buyerLeadId,
            createdById: actor.id,
            assignedToId: actor.id,
            title: option.label,
            type: option.eventType,
            startAt,
            commitment: commitment.value,
            specificData: { buyer_action_type: option.value },
          },
        })
      }
      return { ok: true }
    })
    if ('error' in result) return result
  } catch (error) {
    if (isLockError(error) && error.code === 'ROOT_NOT_FOUND')
      return { error: 'Comprador no encontrado.' }
    return {
      error:
        'No se ha podido confirmar el guardado. Puedes volver a intentarlo con los mismos datos.',
    }
  }
  revalidatePath(`/compradores/${buyerLeadId}`)
  if (next) {
    revalidatePath('/calendario')
    return { ok: true, eventId }
  }
  return { ok: true }
}
