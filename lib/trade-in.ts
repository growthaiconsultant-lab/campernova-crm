import type { TradeInVehicleType, VehicleType } from '@prisma/client'

/**
 * Vehículo de parte de pago / trade-in (CAM-63).
 * Módulo puro: labels y regla de "captación de stock".
 */

export const TRADE_IN_TYPE_LABELS: Record<TradeInVehicleType, string> = {
  COCHE: 'Coche',
  CAMPER: 'Camper',
  AUTOCARAVANA: 'Autocaravana',
  FURGONETA: 'Furgoneta',
  MOTO: 'Moto',
  OTRO: 'Otro',
}

export const TRADE_IN_TYPE_OPTIONS = (
  Object.entries(TRADE_IN_TYPE_LABELS) as [TradeInVehicleType, string][]
).map(([value, label]) => ({ value, label }))

export function isValidTradeInType(value: string): value is TradeInVehicleType {
  return value in TRADE_IN_TYPE_LABELS
}

/**
 * El trade-in solo es captación de stock (crea lead de vendedor) si es una
 * camper o autocaravana — es lo que CampersNova revende en depósito-venta.
 * El resto (coche, moto…) es solo parte de pago, no stock.
 */
export function isStockEligibleTradeIn(
  type: TradeInVehicleType | null | undefined
): type is 'CAMPER' | 'AUTOCARAVANA' {
  return type === 'CAMPER' || type === 'AUTOCARAVANA'
}

/** Mapea el tipo de trade-in elegible al VehicleType del stock. */
export function tradeInTypeToVehicleType(type: TradeInVehicleType): VehicleType | null {
  if (type === 'CAMPER') return 'CAMPER'
  if (type === 'AUTOCARAVANA') return 'AUTOCARAVANA'
  return null
}
