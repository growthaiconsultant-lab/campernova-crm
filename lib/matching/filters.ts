import { assessPair } from './assessment'
import type { MatchingBuyerInput, MatchingVehicleInput } from './types'
export function passesHardFilters(vehicle: MatchingVehicleInput, buyer: MatchingBuyerInput) {
  return assessPair(vehicle, buyer).state === 'apto'
}
