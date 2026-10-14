'use server'

import { BuyerLeadStatus } from '@prisma/client'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAgente } from '@/lib/auth'
import { db } from '@/lib/db'
import { recalculateMatchesForBuyer } from '@/lib/matching'
import {
  BUYER_LEAD_STATUS_LABELS,
  BUYER_LEAD_TRANSITIONS,
  isValidTransition,
} from '@/lib/state-machine'

const statusChangeSchema = z.object({
  leadId: z.string().trim().min(1),
  expectedStatus: z.enum(BuyerLeadStatus),
  status: z.enum(BuyerLeadStatus),
})

export async function setBuyerStatus(input: unknown): Promise<{ ok: true } | { error: string }> {
  const actor = await requireAgente()
  const parsed = statusChangeSchema.safeParse(input)
  if (!parsed.success) return { error: 'Comprador o estado no válido' }

  const { leadId, expectedStatus, status } = parsed.data
  const result = await db.$transaction(async (tx) => {
    const lead = await tx.buyerLead.findUnique({
      where: { id: leadId },
      select: { status: true },
    })
    if (!lead) return { error: 'Comprador no encontrado' }
    // Reintentos del mismo cambio son inocuos incluso si conservan el estado anterior.
    if (lead.status === status) return { changed: false }
    if (lead.status !== expectedStatus) {
      return { error: 'El estado ha cambiado. Revisa el estado actual e inténtalo de nuevo.' }
    }
    if (!isValidTransition(BUYER_LEAD_TRANSITIONS, lead.status, status)) {
      return { error: 'Transición de estado no permitida' }
    }
    if (status === 'CERRADO') {
      const delivery = await tx.delivery.findFirst({
        where: { buyerLeadId: leadId, kind: 'VENTA', status: 'COMPLETADA' },
        select: { id: true },
      })
      if (!delivery) {
        return {
          error: 'El comprador no puede marcarse como Cerrado sin una entrega de venta completada.',
        }
      }
    }

    const updated = await tx.buyerLead.updateMany({
      where: { id: leadId, status: expectedStatus },
      data: { status },
    })
    if (updated.count !== 1) {
      return { error: 'El estado ha cambiado. Revisa el estado actual e inténtalo de nuevo.' }
    }
    await tx.activity.create({
      data: {
        type: 'CAMBIO_ESTADO',
        content: `Estado cambiado: ${BUYER_LEAD_STATUS_LABELS[lead.status]} → ${BUYER_LEAD_STATUS_LABELS[status]}`,
        agentId: actor.id,
        buyerLeadId: leadId,
      },
    })
    return { changed: true }
  })

  if (result.error) return { error: result.error }
  if (result.changed) await recalculateMatchesForBuyer(leadId, db)

  revalidatePath(`/compradores/${leadId}`)
  revalidatePath('/compradores')
  revalidatePath('/compradores/pipeline')
  return { ok: true }
}
