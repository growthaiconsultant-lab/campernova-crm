import type { PrismaClient } from '@prisma/client'
import { sendMatchNotification } from '@/lib/email/send'

export const MATCH_NOTIFICATION_THRESHOLD = 70
export const MATCH_NOTIFICATION_THROTTLE_MINUTES = 30

/// Función pura: decide si hay que silenciar el envío por throttle.
/// `lastSentAt = null` → no hay throttle previo, dejar pasar.
export function shouldThrottle(
  lastSentAt: Date | null,
  now: Date,
  throttleMinutes: number = MATCH_NOTIFICATION_THROTTLE_MINUTES
): boolean {
  if (!lastSentAt) return false
  const elapsedMs = now.getTime() - lastSentAt.getTime()
  return elapsedMs < throttleMinutes * 60 * 1000
}

type NewMatch = {
  vehicleId: string
  buyerLeadId: string
  score: number
}

/// Para cada match recién creado con score ≥ umbral, notifica por email a los
/// agentes asignados (vendedor y comprador). Cada agente respeta su propio
/// throttle de 30 minutos. Errores capturados — no rompe el flujo principal.
export async function notifyHighScoreMatches(
  newMatches: NewMatch[],
  db: PrismaClient
): Promise<void> {
  const highScore = newMatches.filter((m) => m.score >= MATCH_NOTIFICATION_THRESHOLD)
  if (highScore.length === 0) return

  try {
    for (const m of highScore) {
      const [vehicle, buyer] = await Promise.all([
        db.vehicle.findUnique({
          where: { id: m.vehicleId },
          select: {
            brand: true,
            model: true,
            year: true,
            km: true,
            sellerLeadId: true,
            sellerLead: { select: { agent: true } },
          },
        }),
        db.buyerLead.findUnique({
          where: { id: m.buyerLeadId },
          select: {
            id: true,
            name: true,
            vehicleType: true,
            minSeats: true,
            maxBudget: true,
            agent: true,
          },
        }),
      ])

      if (!vehicle || !buyer) continue

      const vehicleSummary = `${vehicle.brand} ${vehicle.model} ${vehicle.year} · ${vehicle.km.toLocaleString('es-ES')} km`
      const buyerParts = [buyer.name]
      if (buyer.vehicleType) {
        buyerParts.push(buyer.vehicleType === 'CAMPER' ? 'Camper' : 'Autocaravana')
      }
      if (buyer.minSeats) buyerParts.push(`${buyer.minSeats}+ plazas`)
      if (buyer.maxBudget) {
        buyerParts.push(
          `hasta ${Number(buyer.maxBudget).toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0,
          })}`
        )
      }
      const buyerSummary = buyerParts.join(' · ')

      const sellerAgent = vehicle.sellerLead.agent
      const buyerAgent = buyer.agent

      const now = new Date()
      const tasks: Promise<unknown>[] = []

      if (sellerAgent && sellerAgent.active && !shouldThrottle(sellerAgent.lastMatchEmailAt, now)) {
        tasks.push(
          (async () => {
            await sendMatchNotification({
              to: sellerAgent.email,
              agentName: sellerAgent.name,
              score: m.score,
              vehicleSummary,
              buyerSummary,
              ctaPath: `/vendedores/${vehicle.sellerLeadId}`,
              ctaLabel: 'Ver mi vendedor',
            })
            await db.user.update({
              where: { id: sellerAgent.id },
              data: { lastMatchEmailAt: now },
            })
          })()
        )
      }

      if (
        buyerAgent &&
        buyerAgent.active &&
        // No notificar dos veces al mismo agente si gestiona los dos lados
        buyerAgent.id !== sellerAgent?.id &&
        !shouldThrottle(buyerAgent.lastMatchEmailAt, now)
      ) {
        tasks.push(
          (async () => {
            await sendMatchNotification({
              to: buyerAgent.email,
              agentName: buyerAgent.name,
              score: m.score,
              vehicleSummary,
              buyerSummary,
              ctaPath: `/compradores/${buyer.id}`,
              ctaLabel: 'Ver mi comprador',
            })
            await db.user.update({
              where: { id: buyerAgent.id },
              data: { lastMatchEmailAt: now },
            })
          })()
        )
      }

      await Promise.all(tasks)
    }
  } catch (err) {
    console.error('[matching] notifyHighScoreMatches failed:', err)
  }
}
