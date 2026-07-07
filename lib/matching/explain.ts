import { RV_CATEGORY_OPTIONS, RV_BED_OPTIONS } from '../rv-taxonomy'
import { scorePair } from './find'
import type { MatchingBuyerInput, MatchingVehicleInput, ScoreBreakdown } from './types'

/**
 * CAM-64: explicación determinista de un match, generada desde el desglose de
 * scoring + los datos del par. Sin LLM. Devuelve motivos ("encaja porque…") y
 * riesgos ("ojo con…") para que el comercial entienda la recomendación.
 */
export type MatchExplanation = {
  reasons: string[]
  risks: string[]
}

const EQUIPMENT_LABELS: Record<string, string> = {
  solar: 'placa solar',
  kitchen: 'cocina',
  bathroom: 'baño',
  shower: 'ducha',
  heating: 'calefacción',
}

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  RV_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
)
const BED_LABELS: Record<string, string> = Object.fromEntries(
  RV_BED_OPTIONS.map((o) => [o.value, o.label])
)

function eur(n: number): string {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

/**
 * Genera la explicación a partir del desglose y los inputs completos del par.
 */
export function explainMatch(
  vehicle: MatchingVehicleInput,
  buyer: MatchingBuyerInput,
  breakdown: ScoreBreakdown
): MatchExplanation {
  const reasons: string[] = []
  const risks: string[] = []

  // ── Categoría / distribución ──
  if (buyer.preferredCategory) {
    if (breakdown.category === 100) {
      reasons.push(`Distribución ${CATEGORY_LABELS[buyer.preferredCategory] ?? ''}`.trim())
    } else if (breakdown.category === 60) {
      risks.push('Distribución sin etiquetar (conviene confirmarla)')
    } else {
      risks.push(
        `Distribución distinta a la preferida (${CATEGORY_LABELS[buyer.preferredCategory] ?? 'la que busca'})`
      )
    }
  }

  // ── Tipo de cama ──
  if (buyer.preferredBedLayout) {
    if (breakdown.bedLayout === 100) {
      reasons.push(`Cama ${BED_LABELS[buyer.preferredBedLayout] ?? ''}`.trim())
    } else if (breakdown.bedLayout === 60) {
      risks.push('Tipo de cama sin etiquetar (conviene confirmarlo)')
    } else {
      risks.push('Tipo de cama distinto al que prefiere')
    }
  }

  // ── Equipamiento crítico ──
  const required = (
    Object.keys(buyer.criticalEquipment) as Array<keyof typeof EQUIPMENT_LABELS>
  ).filter(
    (k) => buyer.criticalEquipment[k as keyof MatchingBuyerInput['criticalEquipment']] === true
  )
  if (required.length > 0) {
    if (breakdown.equipment === 100) {
      reasons.push('Tiene todo el equipamiento crítico que pide')
    } else {
      const missing = required
        .filter((k) => vehicle.equipment[k as keyof typeof vehicle.equipment] !== true)
        .map((k) => EQUIPMENT_LABELS[k] ?? k)
      risks.push(
        missing.length ? `Le falta: ${missing.join(', ')}` : 'Falta parte del equipamiento crítico'
      )
    }
  }

  // ── Precio ──
  if (buyer.maxBudget !== null && vehicle.price !== null) {
    if (breakdown.price === 100) {
      reasons.push(`Dentro de presupuesto (${eur(vehicle.price)} ≤ ${eur(buyer.maxBudget)})`)
    } else {
      risks.push(`Precio por encima del presupuesto ideal (${eur(vehicle.price)})`)
    }
  }

  // ── Antigüedad / km ──
  if (breakdown.ageKm >= 70) {
    reasons.push(
      `Pocos km y vehículo reciente (${vehicle.year}, ${vehicle.km.toLocaleString('es-ES')} km)`
    )
  } else if (breakdown.ageKm < 45) {
    risks.push(
      `Antigüedad o km elevados (${vehicle.year}, ${vehicle.km.toLocaleString('es-ES')} km)`
    )
  }

  // ── Zona ──
  if (buyer.useZone) {
    if (breakdown.zone === 100) {
      reasons.push(`En su zona (${buyer.useZone})`)
    } else {
      risks.push(
        vehicle.location
          ? `Fuera de su zona (está en ${vehicle.location}, busca en ${buyer.useZone})`
          : `Sin ubicación registrada (busca en ${buyer.useZone})`
      )
    }
  }

  return { reasons, risks }
}

/**
 * Conveniencia: calcula el desglose con `scorePair` y devuelve la explicación.
 */
export function buildMatchExplanation(
  vehicle: MatchingVehicleInput,
  buyer: MatchingBuyerInput,
  nowYear: number = new Date().getFullYear()
): MatchExplanation {
  const { breakdown } = scorePair(vehicle, buyer, nowYear)
  return explainMatch(vehicle, buyer, breakdown)
}
