'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { updateBuyerLeadSchema } from '@/lib/validators/buyer-lead'
import { recalculateMatchesForBuyer } from '@/lib/matching'
import {
  BUYER_LEAD_TRANSITIONS,
  BUYER_LEAD_STATUS_LABELS,
  isValidTransition,
} from '@/lib/state-machine'
import type { BuyerLeadStatus } from '@prisma/client'

export async function updateBuyerLead(leadId: string, data: unknown) {
  const actor = await requireAgente()

  const parsed = updateBuyerLeadSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const {
    name,
    email,
    phone,
    status,
    agentId,
    vehicleType,
    minSeats,
    maxBudget,
    criticalEquipment,
    useZone,
    purchaseTimeline,
    preferredCategory,
    preferredBedLayout,
    sleepingPlacesRequired,
    bathroomRequired,
    licenseType,
    needsWinter,
    needsGarage,
    maxLengthM,
    maxHeightM,
    hasKids,
  } = parsed.data

  const currentLead = await db.buyerLead.findUnique({
    where: { id: leadId },
    select: { status: true, agentId: true, agent: { select: { name: true } } },
  })
  if (!currentLead) return { error: { formErrors: ['Lead no encontrado'], fieldErrors: {} } }

  if (!isValidTransition(BUYER_LEAD_TRANSITIONS, currentLead.status, status)) {
    return {
      error: {
        formErrors: [
          `Transición no permitida: ${BUYER_LEAD_STATUS_LABELS[currentLead.status]} → ${BUYER_LEAD_STATUS_LABELS[status]}`,
        ],
        fieldErrors: {},
      },
    }
  }

  if (status === 'CERRADO' && currentLead.status !== 'CERRADO') {
    const delivery = await db.delivery.findFirst({
      where: { buyerLeadId: leadId, status: 'COMPLETADA' },
    })
    if (!delivery) {
      return {
        error: {
          formErrors: [
            'El comprador no puede marcarse como CERRADO sin una entrega completada del vehículo asociado.',
          ],
          fieldErrors: {},
        },
      }
    }
  }

  const agentChanging = agentId !== currentLead.agentId
  const statusChanging = status !== currentLead.status

  if (agentChanging && actor.role !== 'ADMIN') {
    return { error: { formErrors: ['Solo el admin puede reasignar el agente'], fieldErrors: {} } }
  }

  let agentActivityContent: string | null = null
  if (agentChanging) {
    const newAgentName = agentId
      ? ((await db.user.findUnique({ where: { id: agentId }, select: { name: true } }))?.name ??
        agentId)
      : null
    const oldAgentName = currentLead.agent?.name ?? null

    if (!oldAgentName && newAgentName) {
      agentActivityContent = `Asignado a ${newAgentName}`
    } else if (oldAgentName && !newAgentName) {
      agentActivityContent = `Desasignado (antes: ${oldAgentName})`
    } else {
      agentActivityContent = `Reasignado de ${oldAgentName} a ${newAgentName}`
    }
  }

  await db.$transaction(async (tx) => {
    await tx.buyerLead.update({
      where: { id: leadId },
      data: {
        name,
        email,
        phone,
        status,
        agentId: agentId ?? null,
        vehicleType: vehicleType ?? null,
        minSeats: minSeats ?? null,
        maxBudget: maxBudget ?? null,
        criticalEquipment,
        useZone: useZone ?? null,
        purchaseTimeline: purchaseTimeline ?? null,
        preferredCategory: preferredCategory ?? null,
        preferredBedLayout: preferredBedLayout ?? null,
        sleepingPlacesRequired: sleepingPlacesRequired ?? null,
        bathroomRequired: bathroomRequired ?? null,
        licenseType: licenseType ?? null,
        needsWinter: needsWinter ?? null,
        needsGarage: needsGarage ?? null,
        maxLengthM: maxLengthM ?? null,
        maxHeightM: maxHeightM ?? null,
        hasKids: hasKids ?? null,
      },
    })
    if (agentChanging && agentActivityContent) {
      await tx.activity.create({
        data: {
          type: 'LEAD_ASIGNADO',
          content: agentActivityContent,
          agentId: actor.id,
          buyerLeadId: leadId,
        },
      })
    }
    if (statusChanging) {
      await tx.activity.create({
        data: {
          type: 'CAMBIO_ESTADO',
          content: `Estado cambiado: ${BUYER_LEAD_STATUS_LABELS[currentLead.status]} → ${BUYER_LEAD_STATUS_LABELS[status]}`,
          agentId: actor.id,
          buyerLeadId: leadId,
        },
      })
    }
  })

  await recalculateMatchesForBuyer(leadId, db)

  revalidatePath(`/compradores/${leadId}`)
  revalidatePath('/compradores')
  return { ok: true }
}

export async function archiveBuyerLead(leadId: string) {
  const actor = await requireAgente()

  const lead = await db.buyerLead.findUnique({
    where: { id: leadId },
    select: { status: true },
  })
  if (!lead) return { error: 'Lead no encontrado' }

  if (!isValidTransition(BUYER_LEAD_TRANSITIONS, lead.status, 'PERDIDO')) {
    return { error: 'Este lead ya está en estado final' }
  }

  await db.$transaction(async (tx) => {
    await tx.buyerLead.update({
      where: { id: leadId },
      data: { status: 'PERDIDO' },
    })
    await tx.activity.create({
      data: {
        type: 'CAMBIO_ESTADO',
        content: `Estado cambiado: ${BUYER_LEAD_STATUS_LABELS[lead.status as BuyerLeadStatus]} → ${BUYER_LEAD_STATUS_LABELS['PERDIDO']}`,
        agentId: actor.id,
        buyerLeadId: leadId,
      },
    })
  })

  revalidatePath(`/compradores/${leadId}`)
  revalidatePath('/compradores')
  return { error: null }
}

export async function addBuyerLeadNote(leadId: string, content: string) {
  const actor = await requireAgente()

  const trimmed = content.trim()
  if (!trimmed) return { error: 'El contenido no puede estar vacío' }
  if (trimmed.length > 2000) return { error: 'Máximo 2000 caracteres' }

  await db.activity.create({
    data: {
      type: 'NOTA',
      content: trimmed,
      agentId: actor.id,
      buyerLeadId: leadId,
    },
  })

  revalidatePath(`/compradores/${leadId}`)
  return { ok: true }
}
