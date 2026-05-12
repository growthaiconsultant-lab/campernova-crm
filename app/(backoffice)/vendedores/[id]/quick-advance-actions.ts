'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import {
  SELLER_LEAD_TRANSITIONS,
  SELLER_LEAD_STATUS_LABELS,
  isValidTransition,
} from '@/lib/state-machine'
import type { SellerLeadStatus } from '@prisma/client'

export async function advanceLeadStatus(leadId: string, nextStatus: string) {
  const actor = await requireAgente()

  const lead = await db.sellerLead.findUnique({
    where: { id: leadId },
    select: { status: true },
  })
  if (!lead) return { error: 'Lead no encontrado' }

  if (
    !isValidTransition(
      SELLER_LEAD_TRANSITIONS,
      lead.status as SellerLeadStatus,
      nextStatus as SellerLeadStatus
    )
  ) {
    return { error: 'Transición no permitida' }
  }

  await db.$transaction(async (tx) => {
    await tx.sellerLead.update({
      where: { id: leadId },
      data: { status: nextStatus as SellerLeadStatus },
    })
    await tx.activity.create({
      data: {
        type: 'CAMBIO_ESTADO',
        content: `Estado cambiado: ${SELLER_LEAD_STATUS_LABELS[lead.status as SellerLeadStatus]} → ${SELLER_LEAD_STATUS_LABELS[nextStatus as SellerLeadStatus]}`,
        agentId: actor.id,
        sellerLeadId: leadId,
      },
    })
  })

  revalidatePath(`/vendedores/${leadId}`)
  revalidatePath('/vendedores')
  return { error: null }
}
