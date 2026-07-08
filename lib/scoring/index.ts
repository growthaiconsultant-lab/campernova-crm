export {
  buyerScore,
  scoreLabel,
  type BuyerScoreInput,
  type ScoreItem,
  type ScoreResult,
} from './buyer'
export { sellerAcquisitionScore, priceRealismPoints, type SellerScoreInput } from './seller'

/**
 * Umbral de "match de demanda activa": un comprador vivo con un match ≥ este
 * score cuenta como demanda esperando para el vehículo. Usado en las alertas
 * "tenemos compradores para un vehículo así".
 */
export const ACTIVE_DEMAND_MATCH_THRESHOLD = 60
