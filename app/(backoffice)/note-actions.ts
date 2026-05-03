'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function deleteNote(activityId: string) {
  const actor = await requireAuth()

  const activity = await db.activity.findUnique({
    where: { id: activityId },
    select: { agentId: true, type: true, sellerLeadId: true, buyerLeadId: true },
  })

  if (!activity) return { error: 'Nota no encontrada' }
  if (activity.type !== 'NOTA') return { error: 'Solo se pueden eliminar notas' }
  if (activity.agentId !== actor.id) return { error: 'Solo el autor puede eliminar esta nota' }

  await db.activity.delete({ where: { id: activityId } })

  if (activity.sellerLeadId) revalidatePath(`/vendedores/${activity.sellerLeadId}`)
  if (activity.buyerLeadId) revalidatePath(`/compradores/${activity.buyerLeadId}`)

  return { ok: true }
}
