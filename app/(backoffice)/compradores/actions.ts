'use server'

import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { createBuyerLeadSchema } from '@/lib/validators/buyer-lead'
import { recalculateMatchesForBuyer } from '@/lib/matching'
import { defaultNextActionData } from '@/lib/next-action'
import { suggestTemperatureFromTimeline } from '@/lib/lead-temperature'
import { findDuplicateBuyerByPhone, prismaBuyerDedupDeps } from '@/lib/buyer-dedup'

export async function createBuyerLead(data: unknown, allowDuplicate = false) {
  await requireAgente()

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

  // CAM-66: aviso de duplicado por teléfono (a menos que el agente fuerce)
  if (!allowDuplicate) {
    const dup = await findDuplicateBuyerByPhone(phone, prismaBuyerDedupDeps(db))
    if (dup) return { duplicate: dup }
  }

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
      temperature: suggestTemperatureFromTimeline(purchaseTimeline),
      ...defaultNextActionData(),
    },
  })

  await recalculateMatchesForBuyer(lead.id, db)

  return { leadId: lead.id }
}
