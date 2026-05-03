'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function logWhatsApp(params: {
  leadId: string
  leadType: 'seller' | 'buyer'
  phone: string
}) {
  const actor = await requireAuth()

  await db.activity.create({
    data: {
      type: 'WHATSAPP_INICIADO',
      content: `WhatsApp iniciado a ${params.phone}`,
      agentId: actor.id,
      ...(params.leadType === 'seller'
        ? { sellerLeadId: params.leadId }
        : { buyerLeadId: params.leadId }),
    },
  })

  if (params.leadType === 'seller') {
    revalidatePath(`/vendedores/${params.leadId}`)
  } else {
    revalidatePath(`/compradores/${params.leadId}`)
  }

  return { ok: true }
}
