'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import type { MatchStatus } from '@prisma/client'

const VALID_TRANSITIONS: Partial<Record<MatchStatus, MatchStatus[]>> = {
  SUGERIDO: ['PROPUESTO_CLIENTE', 'RECHAZADO'],
  PROPUESTO_CLIENTE: ['VISITA', 'RECHAZADO'],
  VISITA: ['OFERTA', 'RECHAZADO'],
  OFERTA: ['CERRADO', 'RECHAZADO'],
}

export async function updateMatchStatus(matchId: string, newStatus: MatchStatus) {
  await requireAuth()

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      status: true,
      buyerLeadId: true,
      vehicle: { select: { sellerLeadId: true } },
    },
  })

  if (!match) return { error: 'Match no encontrado' }

  const allowed = VALID_TRANSITIONS[match.status]
  if (!allowed?.includes(newStatus)) {
    return { error: `Transición inválida: ${match.status} → ${newStatus}` }
  }

  await db.match.update({ where: { id: matchId }, data: { status: newStatus } })

  revalidatePath(`/vendedores/${match.vehicle.sellerLeadId}`)
  revalidatePath(`/compradores/${match.buyerLeadId}`)
  return { ok: true }
}
