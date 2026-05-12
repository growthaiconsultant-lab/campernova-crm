// ── Lead Score — función pura (0-100) ─────────────────────────────────────────

export type LeadScoreInput = {
  hasPhone: boolean
  hasVehicle: boolean
  photoCount: number
  hasDesiredPrice: boolean
  conservationState: string | null
  matchCount: number
  bestMatchScore: number
  daysSinceLastActivity: number | null
  isPro: boolean
  vehicleStatus: string | null
}

export function calculateLeadScore(input: LeadScoreInput): number {
  let score = 15

  // Datos de contacto
  if (input.hasPhone) score += 5

  // Vehículo completo
  if (input.hasVehicle) score += 5
  if (input.photoCount >= 5) score += 10
  else if (input.photoCount >= 3) score += 6
  else if (input.photoCount >= 1) score += 3
  if (input.hasDesiredPrice) score += 5

  // Conservación
  if (input.conservationState === 'EXCELENTE') score += 5
  else if (input.conservationState === 'BUENO') score += 3

  // Matches
  if (input.bestMatchScore >= 80) score += 15
  else if (input.bestMatchScore >= 60) score += 10
  else if (input.bestMatchScore >= 40) score += 5
  else if (input.matchCount > 0) score += 3

  // Actividad reciente
  if (input.daysSinceLastActivity !== null) {
    if (input.daysSinceLastActivity <= 1) score += 10
    else if (input.daysSinceLastActivity <= 3) score += 7
    else if (input.daysSinceLastActivity <= 7) score += 4
  }

  // Canal PRO
  if (input.isPro) score += 5

  // Progresión estado vehículo
  if (input.vehicleStatus === 'VENDIDO') score += 10
  else if (input.vehicleStatus === 'RESERVADO') score += 8
  else if (input.vehicleStatus === 'PUBLICADO') score += 6
  else if (input.vehicleStatus === 'TASADO') score += 3

  return Math.min(100, Math.max(0, score))
}

// ── Score color ────────────────────────────────────────────────────────────────

export function leadScoreColor(score: number): string {
  if (score >= 75) return 'text-green-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-500'
}

// ── Probabilidad de cierre ────────────────────────────────────────────────────

export function calculateClosureProbability(input: {
  leadStatus: string
  daysSincePipeline: number
  daysSinceLastActivity: number | null
  matchCount: number
}): number {
  const base: Record<string, number> = {
    NUEVO: 10,
    CONTACTADO: 25,
    CUALIFICADO: 45,
    EN_NEGOCIACION: 70,
    CERRADO: 100,
    DESCARTADO: 0,
  }

  let prob = base[input.leadStatus] ?? 10

  if (input.daysSinceLastActivity !== null) {
    if (input.daysSinceLastActivity > 14) prob *= 0.6
    else if (input.daysSinceLastActivity > 7) prob *= 0.8
  }

  if (input.daysSincePipeline > 90) prob *= 0.65
  else if (input.daysSincePipeline > 60) prob *= 0.8

  if (input.matchCount > 0) prob = Math.min(100, prob * 1.1)

  return Math.round(Math.min(100, Math.max(0, prob)))
}
