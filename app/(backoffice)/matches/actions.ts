'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import type { MatchStatus } from '@prisma/client'

const MATCH_STATUSES: MatchStatus[] = [
  'SUGERIDO',
  'PROPUESTO_CLIENTE',
  'VISITA',
  'OFERTA',
  'CERRADO',
  'RECHAZADO',
]

const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  SUGERIDO: 'Sugerido',
  PROPUESTO_CLIENTE: 'Propuesto al cliente',
  VISITA: 'Visita',
  OFERTA: 'Oferta',
  CERRADO: 'Cerrado',
  RECHAZADO: 'Rechazado',
}

export async function updateMatchStatus(matchId: string, newStatus: MatchStatus) {
  const actor = await requireAgente()

  if (!MATCH_STATUSES.includes(newStatus)) return { error: 'Estado de match no válido' }

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      status: true,
      vehicleId: true,
      buyerLeadId: true,
      vehicle: { select: { sellerLeadId: true } },
    },
  })

  if (!match) return { error: 'Match no encontrado' }

  if (newStatus === 'CERRADO' && match.status !== 'CERRADO') {
    const delivery = await db.delivery.findFirst({
      where: { vehicleId: match.vehicleId, status: 'COMPLETADA' },
    })
    if (!delivery) {
      return { error: 'El match no puede cerrarse sin una entrega completada del vehículo.' }
    }
  }

  if (newStatus !== match.status) {
    await db.$transaction(async (tx) => {
      await tx.match.update({ where: { id: matchId }, data: { status: newStatus } })
      const content = `Match: ${MATCH_STATUS_LABELS[match.status]} → ${MATCH_STATUS_LABELS[newStatus]}`
      await Promise.all([
        tx.activity.create({
          data: {
            type: 'CAMBIO_ESTADO',
            content,
            agentId: actor.id,
            sellerLeadId: match.vehicle.sellerLeadId,
          },
        }),
        tx.activity.create({
          data: {
            type: 'CAMBIO_ESTADO',
            content,
            agentId: actor.id,
            buyerLeadId: match.buyerLeadId,
          },
        }),
      ])
    })
  }

  revalidatePath(`/vendedores/${match.vehicle.sellerLeadId}`)
  revalidatePath(`/compradores/${match.buyerLeadId}`)
  return { ok: true }
}
