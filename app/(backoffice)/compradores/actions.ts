'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { createBuyerLeadSchema } from '@/lib/validators/buyer-lead'
import { recalculateMatchesForBuyer } from '@/lib/matching'

export async function createBuyerLead(data: unknown) {
  await requireAuth()

  const parsed = createBuyerLeadSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const {
    name,
    email,
    phone,
    vehicleType,
    minSeats,
    maxBudget,
    criticalEquipment,
    useZone,
    purchaseTimeline,
  } = parsed.data

  const lead = await db.buyerLead.create({
    data: {
      name,
      email,
      phone,
      status: 'NUEVO',
      vehicleType: vehicleType ?? null,
      minSeats: minSeats ?? null,
      maxBudget: maxBudget ?? null,
      criticalEquipment,
      useZone: useZone ?? null,
      purchaseTimeline: purchaseTimeline ?? null,
      agentId: null,
    },
  })

  await recalculateMatchesForBuyer(lead.id, db)

  return { leadId: lead.id }
}
