import type { MatchStatus, PrismaClient } from '@prisma/client'
import { findMatchesForBuyer, findMatchesForVehicle } from './find'
import { prismaMatchingDeps } from './prisma-deps'
import type { ScoredMatch } from './types'
import { notifyHighScoreMatches } from './notify'

export type ExistingMatch = {
  otherId: string
  status: MatchStatus
  generatedBy?: string
}

export type RecalcDiff = {
  toCreate: { otherId: string; score: number }[]
  toUpdateScore: { otherId: string; score: number }[]
  toDeleteSuggested: string[]
}

/// Función pura: dado el top calculado y los matches existentes,
/// decide qué crear, qué actualizar y qué borrar.
///
/// Reglas:
/// - Match manual → conservar, aunque SUGERIDO o fuera del top
/// - Match en el top + no existe → crear con SUGERIDO
/// - Match en el top + existe SUGERIDO → actualizar score
/// - Match en el top + existe en estado posterior → no tocar (decisión del agente manda)
/// - Match no en el top + existe SUGERIDO → borrar (ya no califica)
/// - Match no en el top + existe en estado posterior → no tocar
export function computeRecalcDiff(
  newTop: { otherId: string; score: number }[],
  existing: ExistingMatch[]
): RecalcDiff {
  const existingMap = new Map(existing.map((m) => [m.otherId, m]))
  const newTopIds = new Set(newTop.map((m) => m.otherId))

  const toCreate: { otherId: string; score: number }[] = []
  const toUpdateScore: { otherId: string; score: number }[] = []

  for (const match of newTop) {
    const current = existingMap.get(match.otherId)
    if (current === undefined) {
      toCreate.push(match)
    } else if (current.status === 'SUGERIDO' && current.generatedBy !== 'manual') {
      toUpdateScore.push(match)
    }
  }

  const toDeleteSuggested = existing
    .filter(
      (m) => m.generatedBy !== 'manual' && m.status === 'SUGERIDO' && !newTopIds.has(m.otherId)
    )
    .map((m) => m.otherId)

  return { toCreate, toUpdateScore, toDeleteSuggested }
}

function topToRecalcInput(
  matches: ScoredMatch[],
  side: 'buyer' | 'vehicle'
): { otherId: string; score: number }[] {
  return matches.map((m) => ({
    otherId: side === 'buyer' ? m.buyerLeadId : m.vehicleId,
    score: m.score,
  }))
}

/// Recalcula los matches del vehículo: aplica el diff sobre la tabla `matches`.
/// Captura errores: nunca rompe el flujo principal del Server Action que la llama.
export async function recalculateMatchesForVehicle(
  vehicleId: string,
  db: PrismaClient
): Promise<void> {
  try {
    const top = await findMatchesForVehicle(vehicleId, prismaMatchingDeps(db))

    const existing = await db.match.findMany({
      where: { vehicleId },
      select: { buyerLeadId: true, status: true, generatedBy: true },
    })

    const diff = computeRecalcDiff(
      topToRecalcInput(top, 'buyer'),
      existing.map((m) => ({
        otherId: m.buyerLeadId,
        status: m.status,
        generatedBy: m.generatedBy,
      }))
    )

    for (const m of diff.toCreate) {
      await db.match.create({
        data: {
          vehicleId,
          buyerLeadId: m.otherId,
          score: m.score,
          status: 'SUGERIDO',
          generatedBy: 'auto',
        },
      })
    }

    for (const m of diff.toUpdateScore) {
      await db.match.updateMany({
        where: { vehicleId, buyerLeadId: m.otherId, generatedBy: 'auto', status: 'SUGERIDO' },
        data: { score: m.score },
      })
    }

    if (diff.toDeleteSuggested.length > 0) {
      await db.match.deleteMany({
        where: {
          vehicleId,
          buyerLeadId: { in: diff.toDeleteSuggested },
          status: 'SUGERIDO',
          generatedBy: 'auto',
        },
      })
    }

    // Notificar matches nuevos con score alto (post-insert, no bloqueante)
    await notifyHighScoreMatches(
      diff.toCreate.map((m) => ({ vehicleId, buyerLeadId: m.otherId, score: m.score })),
      db
    )
  } catch (err) {
    console.error('[matching] Recalc fallido para vehicle', vehicleId, err)
  }
}

/// Recalcula los matches del comprador. Mismas reglas, simétrico.
export async function recalculateMatchesForBuyer(
  buyerLeadId: string,
  db: PrismaClient
): Promise<void> {
  try {
    const top = await findMatchesForBuyer(buyerLeadId, prismaMatchingDeps(db))

    const existing = await db.match.findMany({
      where: { buyerLeadId },
      select: { vehicleId: true, status: true, generatedBy: true },
    })

    const diff = computeRecalcDiff(
      topToRecalcInput(top, 'vehicle'),
      existing.map((m) => ({ otherId: m.vehicleId, status: m.status, generatedBy: m.generatedBy }))
    )

    for (const m of diff.toCreate) {
      await db.match.create({
        data: {
          vehicleId: m.otherId,
          buyerLeadId,
          score: m.score,
          status: 'SUGERIDO',
          generatedBy: 'auto',
        },
      })
    }

    for (const m of diff.toUpdateScore) {
      await db.match.updateMany({
        where: { vehicleId: m.otherId, buyerLeadId, generatedBy: 'auto', status: 'SUGERIDO' },
        data: { score: m.score },
      })
    }

    if (diff.toDeleteSuggested.length > 0) {
      await db.match.deleteMany({
        where: {
          buyerLeadId,
          vehicleId: { in: diff.toDeleteSuggested },
          status: 'SUGERIDO',
          generatedBy: 'auto',
        },
      })
    }

    // Notificar matches nuevos con score alto (post-insert, no bloqueante)
    await notifyHighScoreMatches(
      diff.toCreate.map((m) => ({ vehicleId: m.otherId, buyerLeadId, score: m.score })),
      db
    )
  } catch (err) {
    console.error('[matching] Recalc fallido para buyer', buyerLeadId, err)
  }
}
