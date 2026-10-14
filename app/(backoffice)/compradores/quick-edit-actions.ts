'use server'

import { LeadTemperature, NextActionType } from '@prisma/client'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { TEMPERATURE_LABELS } from '@/lib/lead-temperature'
import { NEXT_ACTION_LABELS, formatNextActionDue } from '@/lib/next-action'
import { BUYER_SOURCE_VALUES, buyerSourceLabel } from '@/lib/buyer-source'

const revision = {
  leadId: z.string().trim().min(1),
  expectedUpdatedAt: z.iso.datetime(),
}
const quickEditSchema = z.discriminatedUnion('field', [
  z.object({
    ...revision,
    field: z.literal('source'),
    value: z.enum(BUYER_SOURCE_VALUES).nullable(),
  }),
  z.object({
    ...revision,
    field: z.literal('temperature'),
    value: z.enum(LeadTemperature).nullable(),
  }),
  z.object({ ...revision, field: z.literal('agentId'), value: z.string().min(1).nullable() }),
  z.object({
    ...revision,
    field: z.literal('nextAction'),
    value: z.object({
      type: z.enum(NextActionType).nullable(),
      dueAt: z.iso.datetime().nullable(),
    }),
  }),
])

export async function updateBuyerQuickField(
  input: unknown
): Promise<{ ok: true } | { error: string }> {
  const actor = await requireAgente()
  const parsed = quickEditSchema.safeParse(input)
  if (!parsed.success) return { error: 'Datos de edición no válidos' }
  const request = parsed.data

  const result = await db.$transaction(async (tx) => {
    const lead = await tx.buyerLead.findUnique({
      where: { id: request.leadId },
      select: {
        updatedAt: true,
        source: true,
        temperature: true,
        agentId: true,
        agent: { select: { name: true } },
        nextActionType: true,
        nextActionDueAt: true,
      },
    })
    if (!lead) return { error: 'Comprador no encontrado' }

    let data: {
      source?: string | null
      temperature?: LeadTemperature | null
      agentId?: string | null
      nextActionType?: NextActionType | null
      nextActionDueAt?: Date | null
    }
    let activityType:
      | 'NOTA'
      | 'TEMPERATURA_ACTUALIZADA'
      | 'LEAD_ASIGNADO'
      | 'PROXIMA_ACCION_ACTUALIZADA'
    let content: string
    if (request.field === 'source') {
      if (lead.source === request.value) return { ok: true as const }
      data = { source: request.value }
      activityType = 'NOTA'
      content = `Origen cambiado: ${buyerSourceLabel(lead.source)} → ${buyerSourceLabel(request.value)}`
    } else if (request.field === 'temperature') {
      if (lead.temperature === request.value) return { ok: true as const }
      data = { temperature: request.value }
      activityType = 'TEMPERATURA_ACTUALIZADA'
      content = `Temperatura: ${lead.temperature ? TEMPERATURE_LABELS[lead.temperature] : 'Sin valorar'} → ${request.value ? TEMPERATURE_LABELS[request.value] : 'Sin valorar'}`
    } else if (request.field === 'agentId') {
      if (lead.agentId === request.value) return { ok: true as const }
      const target = request.value
        ? await tx.user.findUnique({
            where: { id: request.value },
            select: { name: true, active: true, role: true },
          })
        : null
      if (
        request.value &&
        (!target || !target.active || !['ADMIN', 'AGENTE'].includes(target.role))
      ) {
        return { error: 'Selecciona un comercial activo' }
      }
      data = { agentId: request.value }
      activityType = 'LEAD_ASIGNADO'
      content = target
        ? lead.agent
          ? `Reasignado de ${lead.agent.name} a ${target.name}`
          : `Asignado a ${target.name}`
        : `Desasignado (antes: ${lead.agent?.name ?? 'Sin asignar'})`
    } else {
      const nextActionType = request.value.type
      const nextActionDueAt =
        nextActionType && request.value.dueAt ? new Date(request.value.dueAt) : null
      if (
        lead.nextActionType === nextActionType &&
        (lead.nextActionDueAt?.getTime() ?? null) === (nextActionDueAt?.getTime() ?? null)
      ) {
        return { ok: true as const }
      }
      data = { nextActionType, nextActionDueAt }
      activityType = 'PROXIMA_ACCION_ACTUALIZADA'
      content = nextActionType
        ? `Próxima acción: ${NEXT_ACTION_LABELS[nextActionType]}${nextActionDueAt ? ` · ${formatNextActionDue(nextActionDueAt)}` : ''}`
        : 'Próxima acción eliminada'
    }

    const updated = await tx.buyerLead.updateMany({
      where: { id: request.leadId, updatedAt: new Date(request.expectedUpdatedAt) },
      data,
    })
    if (updated.count !== 1)
      return { error: 'El comprador ha cambiado. Revisa los datos actuales e inténtalo de nuevo.' }
    await tx.activity.create({
      data: {
        type: activityType,
        content,
        agentId: actor.id,
        buyerLeadId: request.leadId,
      },
    })
    return { ok: true as const }
  })
  if (result.error) return { error: result.error }
  revalidatePath('/compradores')
  revalidatePath(`/compradores/${request.leadId}`)
  revalidatePath('/compradores/pipeline')
  revalidatePath('/dashboard')
  return { ok: true }
}
