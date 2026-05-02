'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { createSellerLeadSchema } from '@/lib/validators/seller-lead'

export async function createSellerLead(data: unknown) {
  await requireAuth()

  const parsed = createSellerLeadSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const {
    name,
    email,
    phone,
    type,
    brand,
    model,
    year,
    km,
    seats,
    length,
    conservationState,
    location,
    desiredPrice,
    equipment,
  } = parsed.data

  const lead = await db.sellerLead.create({
    data: {
      name,
      email,
      phone,
      canal: 'CN',
      status: 'NUEVO',
      agentId: null, // round-robin se implementa en CAM-19
      vehicle: {
        create: {
          type,
          brand,
          model,
          year,
          km,
          seats,
          length: length ?? null,
          conservationState,
          location: location ?? null,
          desiredPrice: desiredPrice ?? null,
          equipment,
          status: 'NUEVO',
        },
      },
    },
  })

  return { leadId: lead.id }
}
