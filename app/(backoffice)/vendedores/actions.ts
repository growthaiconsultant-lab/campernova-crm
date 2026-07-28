'use server'

import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { createSellerLeadSchema } from '@/lib/validators/seller-lead'
import { runAndSavePreliminaryValuation } from '@/lib/valuation/save'
import { recalculateMatchesForVehicle } from '@/lib/matching'
import { defaultNextActionData } from '@/lib/next-action'
import { emitKpiEvent } from '@/lib/kpi/emit'
import { KPI_EVENTS } from '@/lib/kpi/events'

export async function createSellerLead(data: unknown) {
  const actor = await requireAgente()

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
      ...defaultNextActionData(),
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
  // A3: valoración PRELIMINAR (orientativa) — no transiciona a TASADO ni escribe denormalizados
  // oficiales. La transición NUEVO → TASADO ocurre solo vía tasación oficial (entrada + inspección).
  await runAndSavePreliminaryValuation(
    vehicleId,
    {
      brand: brand ?? null,
      model: model ?? null,
      type: type ?? null,
      year: year ?? null,
      km: km ?? null,
      conservationState,
      equipment,
    },
    actor.id
  )
  await recalculateMatchesForVehicle(vehicleId, db)

  await emitKpiEvent({
    event: KPI_EVENTS.SELLER_CREATED,
    entityType: 'seller',
    entityId: lead.id,
    relatedEntityType: 'vehicle',
    relatedEntityId: vehicleId,
    actorUserId: actor.id,
    source: 'ui',
  })

  return { leadId: lead.id }
}
