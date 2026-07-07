'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { isValidTemperature, TEMPERATURE_LABELS } from '@/lib/lead-temperature'

/**
 * CAM-62: fija la temperatura comercial de un lead comprador.
 */
export async function setBuyerTemperature(
  leadId: string,
  temperature: string
): Promise<{ error?: string }> {
  const actor = await requireAgente()

  if (!isValidTemperature(temperature)) {
    return { error: 'Temperatura no válida' }
  }

  const lead = await db.buyerLead.findUnique({
    where: { id: leadId },
    select: { id: true, temperature: true },
  })
  if (!lead) return { error: 'Lead no encontrado' }
  if (lead.temperature === temperature) return {}

  await db.$transaction([
    db.buyerLead.update({ where: { id: leadId }, data: { temperature } }),
    db.activity.create({
      data: {
        type: 'TEMPERATURA_ACTUALIZADA',
        content: `Temperatura: ${lead.temperature ? TEMPERATURE_LABELS[lead.temperature] : 'Sin valorar'} → ${TEMPERATURE_LABELS[temperature]}`,
        agentId: actor.id,
        buyerLeadId: leadId,
      },
    }),
  ])

  revalidatePath(`/compradores/${leadId}`)
  revalidatePath('/compradores')
  return {}
}
