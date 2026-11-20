'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAgente } from '@/lib/auth'
import { db } from '@/lib/db'

const inputSchema = z.object({
  leadId: z.string().min(1),
  previousTitle: z.string().nullable(),
  title: z.string().trim().max(120),
})

export async function saveBuyerFollowupTitle(input: unknown) {
  const actor = await requireAgente()
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { error: 'Escribe un título de hasta 120 caracteres.' }

  const { leadId, previousTitle, title } = parsed.data
  const result = await db.buyerLead.updateMany({
    where: {
      id: leadId,
      followupTitle: previousTitle,
      mergedIntoId: null,
      ...(actor.role === 'AGENTE' ? { agentId: actor.id } : {}),
    },
    data: { followupTitle: title || null },
  })
  if (result.count !== 1) {
    return {
      error: 'El título ha cambiado o ya no puedes editar este comprador. Recarga la página.',
    }
  }

  revalidatePath('/compradores')
  revalidatePath('/compradores/pipeline')
  revalidatePath(`/compradores/${leadId}`)
  return { ok: true }
}
