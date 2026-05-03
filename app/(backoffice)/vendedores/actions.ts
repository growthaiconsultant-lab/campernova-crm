'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { createSellerLeadSchema } from '@/lib/validators/seller-lead'
import { runAndSaveAutoValuation } from '@/lib/valuation/save'
import { recalculateMatchesForVehicle } from '@/lib/matching'

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
      agentId: null,
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
    include: { vehicle: true },
  })

  const vehicleId = lead.vehicle!.id
  await runAndSaveAutoValuation(vehicleId, {
    brand,
    model,
    type,
    year,
    km,
    conservationState,
    equipment,
  })
  await recalculateMatchesForVehicle(vehicleId, db)

  return { leadId: lead.id }
}
