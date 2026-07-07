'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { formatNextActionDue, isValidNextActionType, NEXT_ACTION_LABELS } from '@/lib/next-action'
import type { NextActionType } from '@prisma/client'

type SetNextActionInput = {
  leadType: 'seller' | 'buyer'
  leadId: string
  /** null = quitar la próxima acción */
  type: string | null
  /** ISO string; null = sin fecha */
  dueAt: string | null
}

/**
 * CAM-60: fija (o quita) la próxima acción comercial de un lead.
 * Cualquier agente puede hacerlo. Registra Activity PROXIMA_ACCION_ACTUALIZADA.
 */
export async function setNextAction(input: SetNextActionInput): Promise<{ error?: string }> {
  const user = await requireAgente()

  const { leadType, leadId, type, dueAt } = input

  let actionType: NextActionType | null = null
  if (type !== null) {
    if (!isValidNextActionType(type)) return { error: 'Tipo de acción no válido' }
    actionType = type
  }

  let dueDate: Date | null = null
  if (dueAt) {
    dueDate = new Date(dueAt)
    if (isNaN(dueDate.getTime())) return { error: 'Fecha no válida' }
  }

  const content =
    actionType === null
      ? 'Próxima acción eliminada'
      : `Próxima acción: ${NEXT_ACTION_LABELS[actionType]}${dueDate ? ` · ${formatNextActionDue(dueDate)}` : ''}`

  const data = {
    nextActionType: actionType,
    nextActionDueAt: actionType === null ? null : dueDate,
  }

  try {
    if (leadType === 'seller') {
      const lead = await db.sellerLead.findUnique({ where: { id: leadId }, select: { id: true } })
      if (!lead) return { error: 'Lead no encontrado' }
      await db.$transaction([
        db.sellerLead.update({ where: { id: leadId }, data }),
        db.activity.create({
          data: {
            type: 'PROXIMA_ACCION_ACTUALIZADA',
            content,
            agentId: user.id,
            sellerLeadId: leadId,
          },
        }),
      ])
      revalidatePath(`/vendedores/${leadId}`)
      revalidatePath('/vendedores')
    } else {
      const lead = await db.buyerLead.findUnique({ where: { id: leadId }, select: { id: true } })
      if (!lead) return { error: 'Lead no encontrado' }
      await db.$transaction([
        db.buyerLead.update({ where: { id: leadId }, data }),
        db.activity.create({
          data: {
            type: 'PROXIMA_ACCION_ACTUALIZADA',
            content,
            agentId: user.id,
            buyerLeadId: leadId,
          },
        }),
      ])
      revalidatePath(`/compradores/${leadId}`)
      revalidatePath('/compradores')
    }
    revalidatePath('/dashboard')
    return {}
  } catch (e) {
    console.error('setNextAction error', e)
    return { error: 'No se pudo guardar la próxima acción' }
  }
}
