'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function recordFollowupResponse(
  followupId: string,
  responseNotes: string
): Promise<ActionResult> {
  const actor = await requireAuth()

  const followup = await db.postventaFollowup.findUnique({
    where: { id: followupId },
    select: { warrantyId: true, status: true },
  })
  if (!followup) return { ok: false, error: 'Follow-up no encontrado' }

  await db.postventaFollowup.update({
    where: { id: followupId },
    data: { status: 'RESPONDIDO', respondedAt: new Date(), responseNotes },
  })

  const warranty = await db.warranty.findUnique({
    where: { id: followup.warrantyId },
    select: { buyerLeadId: true },
  })

  await db.activity.create({
    data: {
      type: 'FOLLOWUP_RESPONDIDO',
      content: `Respuesta follow-up registrada: "${responseNotes.slice(0, 100)}"`,
      agentId: actor.id,
      buyerLeadId: warranty?.buyerLeadId ?? null,
    },
  })

  revalidatePath('/postventa')
  return { ok: true }
}

export async function dismissFollowup(followupId: string): Promise<ActionResult> {
  await requireAuth()

  await db.postventaFollowup.update({
    where: { id: followupId },
    data: { status: 'ENVIADO' },
  })

  revalidatePath('/postventa')
  return { ok: true }
}
