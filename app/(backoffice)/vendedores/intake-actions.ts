'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import {
  canDecideSellerIntake,
  sellerIntakeActivityContent,
  sellerIntakeActivityType,
} from '@/lib/seller-intake'

const decisionSchema = z.object({
  leadId: z.string().trim().min(1),
  target: z.enum(['ADMITIDO', 'RECHAZADO']),
})

export async function decideSellerIntake(input: unknown) {
  const actor = await requireAgente()
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { error: 'Solicitud de admisión inválida.' }

  const { leadId, target } = parsed.data
  const result = await db.$transaction(async (tx) => {
    const lead = await tx.sellerLead.findUnique({
      where: { id: leadId },
      select: { canal: true, intakeStatus: true },
    })

    if (!lead) return { error: 'La solicitud ya no existe.' }
    if (lead.canal !== 'PRO') return { error: 'Solo se revisan solicitudes procedentes de la web.' }
    if (!canDecideSellerIntake(lead.intakeStatus, target)) {
      return { error: 'Esta solicitud ya fue admitida y no puede volver a la bandeja de entrada.' }
    }
    if (lead.intakeStatus === target) return { status: 'unchanged' as const }

    const updated = await tx.sellerLead.updateMany({
      where: { id: leadId, canal: 'PRO', intakeStatus: lead.intakeStatus },
      data: {
        intakeStatus: target,
        intakeReviewedAt: new Date(),
        intakeReviewedById: actor.id,
      },
    })
    if (updated.count !== 1) {
      return { error: 'Otra persona revisó esta solicitud. Actualiza la ficha.' }
    }

    await tx.activity.create({
      data: {
        type: sellerIntakeActivityType(target),
        content: sellerIntakeActivityContent(target),
        agentId: actor.id,
        sellerLeadId: leadId,
      },
    })

    return { status: target === 'ADMITIDO' ? ('admitted' as const) : ('rejected' as const) }
  })

  if ('error' in result) return result
  revalidatePath('/vendedores')
  revalidatePath('/vehiculos')
  revalidatePath(`/vendedores/${leadId}`)
  return result
}
