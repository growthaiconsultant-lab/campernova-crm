'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { updateSellerLeadSchema, updateVehicleSchema } from '@/lib/validators/seller-lead'
import { runAndSaveAutoValuation } from '@/lib/valuation/save'
import { recalculateMatchesForVehicle } from '@/lib/matching'
import {
  SELLER_LEAD_TRANSITIONS,
  VEHICLE_TRANSITIONS,
  SELLER_LEAD_STATUS_LABELS,
  VEHICLE_STATUS_LABELS,
  isValidTransition,
} from '@/lib/state-machine'
import type { SellerLeadStatus } from '@prisma/client'
import {
  getVehicleLegalInput,
  getVehicleDocumentSummary,
  listMissingRequirements,
  isReadyForStatus,
} from '@/lib/vehicle-legal'

export async function updateSellerLead(leadId: string, data: unknown) {
  const actor = await requireAgente()

  const parsed = updateSellerLeadSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const { name, email, phone, status, agentId } = parsed.data

  const currentLead = await db.sellerLead.findUnique({
    where: { id: leadId },
    select: { status: true, agentId: true, agent: { select: { name: true } } },
  })
  if (!currentLead) return { error: { formErrors: ['Lead no encontrado'], fieldErrors: {} } }

  if (!isValidTransition(SELLER_LEAD_TRANSITIONS, currentLead.status, status)) {
    return {
      error: {
        formErrors: [
          `Transición no permitida: ${SELLER_LEAD_STATUS_LABELS[currentLead.status]} → ${SELLER_LEAD_STATUS_LABELS[status]}`,
        ],
        fieldErrors: {},
      },
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
    await tx.sellerLead.update({
      where: { id: leadId },
      data: { name, email, phone, status, agentId: agentId ?? null },
    })
    if (agentChanging && agentActivityContent) {
      await tx.activity.create({
        data: {
          type: 'LEAD_ASIGNADO',
          content: agentActivityContent,
          agentId: actor.id,
          sellerLeadId: leadId,
        },
      })
    }
    if (statusChanging) {
      await tx.activity.create({
        data: {
          type: 'CAMBIO_ESTADO',
          content: `Estado cambiado: ${SELLER_LEAD_STATUS_LABELS[currentLead.status]} → ${SELLER_LEAD_STATUS_LABELS[status]}`,
          agentId: actor.id,
          sellerLeadId: leadId,
        },
      })
    }
  })

  revalidatePath(`/vendedores/${leadId}`)
  revalidatePath('/vendedores')
  return { ok: true }
}

export async function updateVehicle(vehicleId: string, data: unknown) {
  const actor = await requireAgente()

  const parsed = updateVehicleSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const {
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
    status,
  } = parsed.data

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true, status: true },
  })
  if (!vehicle) return { error: { formErrors: ['Vehículo no encontrado'], fieldErrors: {} } }

  if (!isValidTransition(VEHICLE_TRANSITIONS, vehicle.status, status)) {
    return {
      error: {
        formErrors: [
          `Transición no permitida: ${VEHICLE_STATUS_LABELS[vehicle.status]} → ${VEHICLE_STATUS_LABELS[status]}`,
        ],
        fieldErrors: {},
      },
    }
  }

  // ── Legal guards for TASADO and PUBLICADO ──────────────────────────────────
  const isTransitioningTo = (s: string) => status === s && vehicle.status !== s

  if (isTransitioningTo('TASADO') || isTransitioningTo('PUBLICADO')) {
    const targetStatus = status as 'TASADO' | 'PUBLICADO'
    const [legalInput, docs] = await Promise.all([
      getVehicleLegalInput(db, vehicleId),
      getVehicleDocumentSummary(db, vehicleId),
    ])

    // Merge desiredPrice from the incoming form data (not yet saved)
    const merged = legalInput
      ? { ...legalInput, desiredPrice: desiredPrice ?? legalInput.desiredPrice }
      : null

    if (!merged || !isReadyForStatus(merged, targetStatus, docs)) {
      const missing = merged ? listMissingRequirements(merged, targetStatus, docs) : []
      const lines = missing.filter((r) => r.severity === 'error').map((r) => `- ${r.message}`)

      // Log the blocked attempt as an activity
      await db.activity.create({
        data: {
          type: 'PUBLICACION_BLOQUEADA',
          content: `Intento de pasar a ${VEHICLE_STATUS_LABELS[targetStatus]} bloqueado.\n${lines.join('\n')}`,
          agentId: actor.id,
          sellerLeadId: vehicle.sellerLeadId,
        },
      })

      return {
        error: {
          formErrors: [
            `El vehículo no puede pasar a ${VEHICLE_STATUS_LABELS[targetStatus]}. Faltan:\n${lines.join('\n')}\n\nCompleta el expediente legal en la sección 'Expediente' de la ficha del vehículo antes de reintentar.`,
          ],
          fieldErrors: {},
        },
      }
    }
  }

  if (status === 'VENDIDO' && vehicle.status !== 'VENDIDO') {
    const delivery = await db.delivery.findFirst({
      where: {
        vehicleId,
        status: 'COMPLETADA',
        signedByName: { not: null },
        signedByDni: { not: null },
        signatureUrl: { not: null },
      },
    })
    if (!delivery) {
      return {
        error: {
          formErrors: [
            'El vehículo no puede marcarse como VENDIDO sin una entrega completada y firmada. Crea la entrega desde /entregas.',
          ],
          fieldErrors: {},
        },
      }
    }
  }

  const statusChanging = status !== vehicle.status

  await db.$transaction(async (tx) => {
    await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
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
        status,
      },
    })
    if (statusChanging) {
      await tx.activity.create({
        data: {
          type: 'CAMBIO_ESTADO',
          content: `Vehículo: ${VEHICLE_STATUS_LABELS[vehicle.status]} → ${VEHICLE_STATUS_LABELS[status]}`,
          agentId: actor.id,
          sellerLeadId: vehicle.sellerLeadId,
        },
      })
    }
  })

  // Re-tasar automáticamente tras cualquier cambio de datos del vehículo
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

  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  return { ok: true }
}

export async function archiveSellerLead(leadId: string) {
  const actor = await requireAgente()

  const lead = await db.sellerLead.findUnique({
    where: { id: leadId },
    select: { status: true },
  })
  if (!lead) return { error: 'Lead no encontrado' }

  if (!isValidTransition(SELLER_LEAD_TRANSITIONS, lead.status, 'DESCARTADO')) {
    return { error: 'Este lead ya está en estado final' }
  }

  await db.$transaction(async (tx) => {
    await tx.sellerLead.update({
      where: { id: leadId },
      data: { status: 'DESCARTADO' },
    })
    await tx.activity.create({
      data: {
        type: 'CAMBIO_ESTADO',
        content: `Estado cambiado: ${SELLER_LEAD_STATUS_LABELS[lead.status as SellerLeadStatus]} → ${SELLER_LEAD_STATUS_LABELS['DESCARTADO']}`,
        agentId: actor.id,
        sellerLeadId: leadId,
      },
    })
  })

  revalidatePath(`/vendedores/${leadId}`)
  revalidatePath('/vendedores')
  return { error: null }
}

export async function addSellerLeadNote(leadId: string, content: string) {
  const actor = await requireAgente()

  const trimmed = content.trim()
  if (!trimmed) return { error: 'El contenido no puede estar vacío' }
  if (trimmed.length > 2000) return { error: 'Máximo 2000 caracteres' }

  await db.activity.create({
    data: {
      type: 'NOTA',
      content: trimmed,
      agentId: actor.id,
      sellerLeadId: leadId,
    },
  })

  revalidatePath(`/vendedores/${leadId}`)
  return { ok: true }
}

const overrideValuationSchema = z
  .object({
    min: z.number().positive('Debe ser mayor que 0'),
    recommended: z.number().positive('Debe ser mayor que 0'),
    max: z.number().positive('Debe ser mayor que 0'),
  })
  .refine((d) => d.recommended >= d.min, {
    message: 'El precio recomendado debe ser ≥ mínimo',
    path: ['recommended'],
  })
  .refine((d) => d.max >= d.recommended, {
    message: 'El máximo debe ser ≥ recomendado',
    path: ['max'],
  })

export async function overrideValuation(vehicleId: string, data: unknown) {
  const actor = await requireAgente()

  const parsed = overrideValuationSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const { min, recommended, max } = parsed.data

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true, status: true },
  })
  if (!vehicle) return { error: { formErrors: ['Vehículo no encontrado'], fieldErrors: {} } }

  const wasNuevo = vehicle.status === 'NUEVO'

  // Escritura directa — la tasación manual no pasa por el algoritmo
  await db.$transaction([
    db.valuation.create({
      data: {
        vehicleId,
        min,
        recommended,
        max,
        method: 'MANUAL',
        confidence: 'ALTA',
        parameters: { source: 'manual_override' },
        createdById: actor.id,
      },
    }),
    db.vehicle.update({
      where: { id: vehicleId },
      data: {
        valuationMin: min,
        valuationRecommended: recommended,
        valuationMax: max,
        ...(wasNuevo ? { status: 'TASADO' } : {}),
      },
    }),
    db.activity.create({
      data: {
        type: 'CAMBIO_ESTADO',
        content: wasNuevo
          ? 'Tasación manual registrada → Estado cambiado: Nuevo → Tasado'
          : 'Tasación manual sobreescrita por el agente',
        agentId: actor.id,
        sellerLeadId: vehicle.sellerLeadId,
      },
    }),
  ])

  await recalculateMatchesForVehicle(vehicleId, db)

  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  return { ok: true }
}
