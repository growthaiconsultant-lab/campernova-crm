export { findMatchesForBuyer, findMatchesForVehicle, scorePair } from './find'
export {
  ELIGIBLE_VEHICLE_STATUSES,
  INELIGIBLE_BUYER_STATUSES,
  eligibleBuyerCounterpartMatchWhere,
  eligibleBuyerWhere,
  eligibleMatchWhere,
  eligibleVehicleCounterpartMatchWhere,
  eligibleVehicleWhere,
  isBuyerEligible,
  isVehicleEligible,
} from './eligibility'
export type { BuyerEligibilityInput, VehicleEligibilityInput } from './eligibility'
export { passesHardFilters } from './filters'
export { buildMatchExplanation, explainMatch } from './explain'
export type { MatchExplanation } from './explain'
export { prismaMatchingDeps } from './prisma-deps'
export {
  computeRecalcDiff,
  recalculateMatchesForBuyer,
  recalculateMatchesForVehicle,
} from './recalculate'
export type { ExistingMatch, RecalcDiff } from './recalculate'
export { scoreAgeKm, scoreEquipment, scorePrice, scoreZone } from './scoring'
export type {
  MatchingBuyerInput,
  MatchingDeps,
  MatchingVehicleInput,
  ScoreBreakdown,
  ScoredMatch,
} from './types'
export { TOP_N, WEIGHTS } from './types'
