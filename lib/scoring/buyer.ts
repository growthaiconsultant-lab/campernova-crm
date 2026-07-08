import type { LeadTemperature } from '@prisma/client'

/**
 * Block 19 — Buyer score (Fase 2 del roadmap infraestructura).
 * Puntúa la calidad/probabilidad de un comprador combinando datos de
 * cualificación (contacto, presupuesto, financiación B17, plazo, temperatura),
 * el mejor match disponible y la existencia de una oferta activa (B18).
 * Puro y determinista (sin LLM); devuelve 0-100 + desglose explicable.
 */

export type BuyerScoreInput = {
  phone: string | null
  email: string | null
  vehicleType: string | null
  minSeats: number | null
  maxBudget: number | null
  financingNeeded: boolean | null
  purchaseTimeline: string | null
  temperature: LeadTemperature | null
  status: string
  bestMatchScore: number // 0-100 del mejor vehículo compatible
  hasActiveOffer: boolean // tiene una oferta viva (B18)
}

export type ScoreItem = { label: string; points: number; max: number }
export type ScoreResult = { score: number; breakdown: ScoreItem[] }

const TIMELINE_POINTS: Record<string, number> = {
  menos_1_mes: 15,
  '1_3_meses': 10,
  '3_6_meses': 5,
  mas_6_meses: 2,
  sin_prisa: 0,
}

const TEMP_POINTS: Record<LeadTemperature, number> = { HOT: 18, WARM: 9, COLD: 0 }

export function buyerScore(b: BuyerScoreInput): ScoreResult {
  const breakdown: ScoreItem[] = []
  const add = (label: string, points: number, max: number) => breakdown.push({ label, points, max })

  // Contacto (10)
  add('Contacto', (b.phone ? 6 : 0) + (b.email ? 4 : 0), 10)
  // Necesidad definida (10): tipo + plazas
  add('Necesidad definida', (b.vehicleType ? 6 : 0) + (b.minSeats ? 4 : 0), 10)
  // Presupuesto (12)
  add('Presupuesto', b.maxBudget ? 12 : 0, 12)
  // Financiación cualificada (8): saber sí/no ya cualifica
  add('Financiación clara', b.financingNeeded != null ? 8 : 0, 8)
  // Plazo de compra (15)
  add('Plazo de compra', b.purchaseTimeline ? (TIMELINE_POINTS[b.purchaseTimeline] ?? 0) : 0, 15)
  // Temperatura (18)
  add('Temperatura', b.temperature ? TEMP_POINTS[b.temperature] : 0, 18)
  // Mejor match (22)
  const matchPts =
    b.bestMatchScore >= 80
      ? 22
      : b.bestMatchScore >= 60
        ? 16
        : b.bestMatchScore >= 40
          ? 9
          : b.bestMatchScore > 0
            ? 4
            : 0
  add('Mejor match', matchPts, 22)
  // Oferta activa (15)
  add('Oferta activa', b.hasActiveOffer ? 15 : 0, 15)

  const raw = breakdown.reduce((s, i) => s + i.points, 0)
  return { score: Math.min(100, raw), breakdown }
}

/** Etiqueta cualitativa del score (para badges). */
export function scoreLabel(score: number): 'Alto' | 'Medio' | 'Bajo' {
  if (score >= 70) return 'Alto'
  if (score >= 40) return 'Medio'
  return 'Bajo'
}
