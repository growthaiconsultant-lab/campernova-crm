import { isBuyerEligible, isVehicleEligible } from './eligibility'
import { assessPair } from './assessment'
import {
  scoreAgeKm,
  scoreBedLayout,
  scoreCategory,
  scoreEquipment,
  scorePrice,
  scoreZone,
} from './scoring'
import type {
  MatchingBuyerInput,
  MatchingDeps,
  MatchingVehicleInput,
  ScoreBreakdown,
  ScoredMatch,
} from './types'
import { TOP_N, WEIGHTS } from './types'

function weightedTotal(breakdown: ScoreBreakdown): number {
  const total =
    (breakdown.category * WEIGHTS.category +
      breakdown.bedLayout * WEIGHTS.bedLayout +
      breakdown.equipment * WEIGHTS.equipment +
      breakdown.price * WEIGHTS.price +
      breakdown.ageKm * WEIGHTS.ageKm +
      breakdown.zone * WEIGHTS.zone) /
    100
  return Math.round(total)
}

/// Calcula breakdown + score final para un par (vehicle, buyer) que ya pasó los filtros duros.
export function scorePair(
  vehicle: MatchingVehicleInput,
  buyer: MatchingBuyerInput,
  nowYear: number = new Date().getFullYear(),
  assessment = assessPair(vehicle, buyer)
): ScoredMatch {
  const breakdown: ScoreBreakdown = {
    category: scoreCategory(vehicle.category, buyer.preferredCategory),
    bedLayout: scoreBedLayout(vehicle.bedLayout, buyer.preferredBedLayout),
    equipment: scoreEquipment(vehicle.equipment, buyer.criticalEquipment),
    price: scorePrice(vehicle.price, buyer.maxBudget),
    ageKm: scoreAgeKm(vehicle.year, vehicle.km, nowYear),
    zone: scoreZone(vehicle.location, buyer.useZone),
  }

  return {
    vehicleId: vehicle.id,
    buyerLeadId: buyer.id,
    score: assessment.state === 'apto' ? assessment.score : 0,
    breakdown,
  }
}

function addRecommendation(
  matches: ScoredMatch[],
  vehicle: MatchingVehicleInput,
  buyer: MatchingBuyerInput,
  nowYear: number
) {
  const assessment = assessPair(vehicle, buyer)
  if (assessment.state !== 'apto' || (!assessment.met.length && !assessment.wanted.length)) return
  matches.push(scorePair(vehicle, buyer, nowYear, assessment))
}

function topN(matches: ScoredMatch[]): ScoredMatch[] {
  return matches.sort(compareMatches).slice(0, TOP_N)
}
export function compareMatches(a: ScoredMatch, b: ScoredMatch) {
  return (
    b.score - a.score ||
    weightedTotal(b.breakdown) - weightedTotal(a.breakdown) ||
    a.vehicleId.localeCompare(b.vehicleId) ||
    a.buyerLeadId.localeCompare(b.buyerLeadId)
  )
}

/// Encuentra los top 10 compradores para un vehículo dado.
/// Devuelve [] si el vehículo no existe.
export async function findMatchesForVehicle(
  vehicleId: string,
  deps: MatchingDeps,
  nowYear: number = new Date().getFullYear()
): Promise<ScoredMatch[]> {
  const vehicle = await deps.getVehicle(vehicleId)
  if (!vehicle) return []
  // Guard M1: no se generan matches para un SUJETO no elegible (vehículo fuera de
  // stock comercializable o de vendedor archivado). Solo se aplica cuando el adapter
  // aporta el estado; los fixtures de scoring que lo omiten mantienen su comportamiento.
  if (
    vehicle.status !== undefined &&
    !isVehicleEligible({
      status: vehicle.status,
      sellerArchivedAt: vehicle.sellerArchivedAt ?? null,
      entryValidatedAt: vehicle.entryValidatedAt ?? null,
      entryAnnulledAt: vehicle.entryAnnulledAt ?? null,
    })
  ) {
    return []
  }

  const buyers = await deps.listEligibleBuyers()
  const matches: ScoredMatch[] = []

  for (const buyer of buyers) {
    addRecommendation(matches, vehicle, buyer, nowYear)
  }

  return topN(matches)
}

/// Encuentra los top 10 vehículos para un comprador dado.
/// Devuelve [] si el comprador no existe.
export async function findMatchesForBuyer(
  buyerLeadId: string,
  deps: MatchingDeps,
  nowYear: number = new Date().getFullYear()
): Promise<ScoredMatch[]> {
  const buyer = await deps.getBuyer(buyerLeadId)
  if (!buyer) return []
  // Guard M1: no se generan matches para un SUJETO no elegible (comprador archivado
  // o en estado terminal). Solo se aplica cuando el adapter aporta el estado.
  if (
    buyer.status !== undefined &&
    !isBuyerEligible({ status: buyer.status, archivedAt: buyer.archivedAt ?? null })
  ) {
    return []
  }

  const vehicles = await deps.listEligibleVehicles()
  const matches: ScoredMatch[] = []

  for (const vehicle of vehicles) {
    addRecommendation(matches, vehicle, buyer, nowYear)
  }

  return topN(matches)
}
