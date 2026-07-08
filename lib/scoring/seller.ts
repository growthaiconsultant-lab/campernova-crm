import type { SellerUrgency, SellerRisk } from '@prisma/client'
import type { ScoreItem, ScoreResult } from './buyer'

/**
 * Block 19 — Seller acquisition score. Puntúa cómo de atractivo es captar este
 * vehículo para el depósito-venta, combinando realismo de precio (pide vs
 * tasación), urgencia y riesgo (condiciones de operación B17) y demanda activa
 * (compradores esperando). Sirve para priorizar captación. Puro y explicable.
 */

export type SellerScoreInput = {
  desiredPrice: number | null // lo que pide el vendedor
  minPrice: number | null // mínimo aceptado (B17)
  valuationRecommended: number | null // nuestra tasación
  urgency: SellerUrgency | null // B17
  riskLevel: SellerRisk | null // B17
  activeDemandCount: number // compradores activos compatibles esperando
}

const URGENCY_POINTS: Record<SellerUrgency, number> = { ALTA: 20, MEDIA: 11, BAJA: 5 }
const RISK_POINTS: Record<SellerRisk, number> = { BAJO: 20, MEDIO: 10, ALTO: 0 }

/** Realismo de precio: cuanto más cerca (o por debajo) de la tasación, mejor. */
export function priceRealismPoints(desiredPrice: number | null, valuation: number | null): number {
  if (desiredPrice == null || valuation == null || valuation <= 0) return 12 // sin datos → neutral
  const ratio = desiredPrice / valuation
  if (ratio <= 1.0) return 25 // pide igual o menos que la tasación
  if (ratio <= 1.1) return 18
  if (ratio <= 1.2) return 10
  if (ratio <= 1.35) return 4
  return 0 // muy sobrevalorado
}

export function sellerAcquisitionScore(s: SellerScoreInput): ScoreResult {
  const breakdown: ScoreItem[] = []
  const add = (label: string, points: number, max: number) => breakdown.push({ label, points, max })

  add('Realismo de precio', priceRealismPoints(s.desiredPrice, s.valuationRecommended), 25)
  add('Urgencia', s.urgency ? URGENCY_POINTS[s.urgency] : 10, 20)
  add('Riesgo (inverso)', s.riskLevel ? RISK_POINTS[s.riskLevel] : 10, 20)
  const demandPts = s.activeDemandCount >= 3 ? 35 : s.activeDemandCount >= 1 ? 22 : 0
  add('Demanda activa', demandPts, 35)

  const raw = breakdown.reduce((s2, i) => s2 + i.points, 0)
  return { score: Math.min(100, raw), breakdown }
}
