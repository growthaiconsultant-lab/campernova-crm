'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import type { MatchStatus } from '@prisma/client'

const VALID_TRANSITIONS: Partial<Record<MatchStatus, MatchStatus[]>> = {
  SUGERIDO: ['PROPUESTO_CLIENTE', 'RECHAZADO'],
  PROPUESTO_CLIENTE: ['VISITA', 'RECHAZADO'],
  VISITA: ['OFERTA', 'RECHAZADO'],
  OFERTA: ['CERRADO', 'RECHAZADO'],
}

export async function updateMatchStatus(matchId: string, newStatus: MatchStatus) {
  await requireAgente()

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

  const allowed = VALID_TRANSITIONS[match.status]
  if (!allowed?.includes(newStatus)) {
    return { error: `Transición inválida: ${match.status} → ${newStatus}` }
  }

  if (newStatus === 'CERRADO') {
    const delivery = await db.delivery.findFirst({
      where: { vehicleId: match.vehicleId, status: 'COMPLETADA' },
    })
    if (!delivery) {
      return { error: 'El match no puede cerrarse sin una entrega completada del vehículo.' }
    }
  }

  await db.match.update({ where: { id: matchId }, data: { status: newStatus } })

  revalidatePath(`/vendedores/${match.vehicle.sellerLeadId}`)
  revalidatePath(`/compradores/${match.buyerLeadId}`)
  return { ok: true }
}
