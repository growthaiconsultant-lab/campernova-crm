// ── Sugerencias del asistente — reglas puras (sin API) ───────────────────────

export type InsightSeverity = 'warning' | 'info' | 'success'

export type LeadInsight = {
  severity: InsightSeverity
  text: string
  detail: string
}

export type LeadInsightInput = {
  daysSinceLastActivity: number | null
  daysSincePipeline: number
  matchCount: number
  topMatchScore: number
  topMatchBuyerName: string | null
  desiredPrice: number | null
  valuationRecommended: number | null
  photoCount: number
  vehicleStatus: string | null
  expedientePercent: number
  leadStatus: string
}

function formatK(val: number): string {
  return `${Math.round(val / 1000)}k€`
}

export function generateLeadInsights(input: LeadInsightInput): LeadInsight[] {
  const insights: LeadInsight[] = []

  // ── 1. Riesgo de enfriamiento ──────────────────────────────────────────────
  if (input.daysSinceLastActivity !== null && input.daysSinceLastActivity >= 5) {
    const days = input.daysSinceLastActivity
    insights.push({
      severity: 'warning',
      text: `Riesgo de enfriamiento: el lead lleva ${days} días sin contacto.`,
      detail:
        'Leads similares se enfrían a partir del día 5 — la probabilidad de cierre cae un 40% pasada esta semana.',
    })
  }

  // ── 2. Matches activos ─────────────────────────────────────────────────────
  if (input.matchCount >= 1 && input.topMatchScore >= 65 && input.topMatchBuyerName) {
    const extra = input.matchCount > 1 ? ` y ${input.matchCount - 1} más` : ''
    insights.push({
      severity: 'info',
      text: `Match potencial: ${input.matchCount} comprador${input.matchCount > 1 ? 'es' : ''} activo${input.matchCount > 1 ? 's' : ''} buscando este vehículo.`,
      detail: `"${input.topMatchBuyerName}"${extra} están en el rango buscado. Ver candidatos →`,
    })
  }

  // ── 3. Precio por encima de tasación ─────────────────────────────────────
  if (
    input.desiredPrice &&
    input.valuationRecommended &&
    input.desiredPrice > input.valuationRecommended * 1.04
  ) {
    const pct = Math.round(
      ((input.desiredPrice - input.valuationRecommended) / input.valuationRecommended) * 100
    )
    insights.push({
      severity: 'info',
      text: `Precio competitivo: está ${pct}% por encima de la mediana del mercado.`,
      detail: `Vehículos similares: ${formatK(input.valuationRecommended * 0.9)}–${formatK(input.valuationRecommended * 1.1)}. Considera ajustar a ${formatK(input.valuationRecommended)}.`,
    })
  }

  // ── 4. Sin fotos ──────────────────────────────────────────────────────────
  if (input.photoCount === 0 && input.vehicleStatus !== null) {
    insights.push({
      severity: 'warning',
      text: 'Sin fotos del vehículo.',
      detail: 'Los leads con fotos tienen 3× más probabilidad de cierre. Sube al menos 5.',
    })
  }

  // ── 5. Expediente incompleto en estado avanzado ────────────────────────────
  if (
    input.expedientePercent < 100 &&
    (input.vehicleStatus === 'PUBLICADO' || input.vehicleStatus === 'TASADO')
  ) {
    insights.push({
      severity: 'warning',
      text: `Expediente incompleto al ${input.expedientePercent}%.`,
      detail: 'Faltan documentos obligatorios para cerrar la venta. Revisa el expediente legal.',
    })
  }

  return insights.slice(0, 4)
}

// ── Próxima acción recomendada ────────────────────────────────────────────────

export type NextAction = {
  urgency: 'urgente' | 'alta' | 'normal'
  title: string
  description: string
}

export function getNextAction(input: LeadInsightInput): NextAction {
  // Prioridad 1: lead sin contacto hace días
  if (input.daysSinceLastActivity !== null && input.daysSinceLastActivity >= 7) {
    return {
      urgency: 'urgente',
      title: `Contactar hoy`,
      description: `El lead lleva ${input.daysSinceLastActivity} días sin un contacto productivo. Un mensaje fallido. La ventana de cierre se está estrechando.`,
    }
  }

  // Prioridad 2: hay matches para presentar
  if (input.matchCount >= 1 && input.topMatchScore >= 70) {
    return {
      urgency: 'alta',
      title: 'Presentar compradores interesados',
      description: `Hay ${input.matchCount} comprador${input.matchCount > 1 ? 'es' : ''} con match ≥70. Proponer una visita acelera el cierre.`,
    }
  }

  // Prioridad 3: vehículo sin publicar y expediente completo
  if (input.vehicleStatus === 'TASADO' && input.expedientePercent >= 80) {
    return {
      urgency: 'alta',
      title: 'Publicar vehículo',
      description: 'El expediente está casi completo. Coordina la publicación en portales.',
    }
  }

  // Default
  return {
    urgency: 'normal',
    title: 'Hacer seguimiento',
    description: `El lead lleva ${input.daysSincePipeline} días en pipeline. Mantén el contacto activo.`,
  }
}
