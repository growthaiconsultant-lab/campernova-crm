'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireAgente } from '@/lib/auth'
import { createBuyerLeadSchema } from '@/lib/validators/buyer-lead'
import { recalculateMatchesForBuyer } from '@/lib/matching'
import { defaultNextActionData } from '@/lib/next-action'
import { suggestTemperatureFromTimeline } from '@/lib/lead-temperature'
import {
  lockBuyerIdentity,
  findBuyerIdentity,
  rememberBuyerContact,
  BuyerIdentityConflict,
} from '@/lib/buyer-identity'
import { emitKpiEvent } from '@/lib/kpi/emit'
import { KPI_EVENTS } from '@/lib/kpi/events'

export async function createBuyerLead(data: unknown, allowDuplicate = false) {
  void allowDuplicate // Legacy clients cannot override the shared contact identity.
  const actor = await requireAgente()

  const parsed = createBuyerLeadSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const {
    name,
    email,
    phone,
    source,
    vehicleType,
    minSeats,
    maxBudget,
    financingNeeded,
    maxMonthlyPayment,
    criticalEquipment,
    useZone,
    purchaseTimeline,
  } = parsed.data

  const result = await db
    .$transaction(async (tx) => {
      await lockBuyerIdentity(tx)
      const duplicate = await findBuyerIdentity(tx, { phone, email })
      if (duplicate)
        return { duplicate: { id: duplicate.id, name: duplicate.name, status: duplicate.status } }
      const lead = await tx.buyerLead.create({
        data: {
          name,
          email,
          phone,
          source: source ?? null,
          status: 'NUEVO',
          vehicleType: vehicleType ?? null,
          minSeats: minSeats ?? null,
          maxBudget: maxBudget ?? null,
          financingNeeded: financingNeeded ?? null,
          maxMonthlyPayment: maxMonthlyPayment ?? null,
          criticalEquipment,
          useZone: useZone ?? null,
          purchaseTimeline: purchaseTimeline ?? null,
          agentId: null,
          temperature: suggestTemperatureFromTimeline(purchaseTimeline),
          ...defaultNextActionData(),
        },
      })
      await rememberBuyerContact(tx, lead.id, { phone, email })
      return { lead }
    })
    .catch((error) => {
      if (error instanceof BuyerIdentityConflict)
        return { error: { formErrors: [error.message], fieldErrors: {} } }
      throw error
    })
  if ('error' in result) return result
  if ('duplicate' in result) return { duplicate: result.duplicate }
  const lead = result.lead

  await recalculateMatchesForBuyer(lead.id, db)

  await emitKpiEvent({
    event: KPI_EVENTS.BUYER_CREATED,
    entityType: 'buyer',
    entityId: lead.id,
    actorUserId: actor.id,
    source: 'ui',
  })

  revalidatePath('/compradores')
  return { leadId: lead.id }
}
