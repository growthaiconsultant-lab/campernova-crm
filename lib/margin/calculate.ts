import type { VehicleCostCategory } from '@prisma/client'
import type { VehicleMarginInput, VehicleMarginOutput } from './types'

export function calculateVehicleMargin(input: VehicleMarginInput): VehicleMarginOutput {
  const { purchasePrice, salePrice, marginPercentTarget, costs } = input

  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0)

  const costsByCategory: Partial<Record<VehicleCostCategory, number>> = {}
  for (const c of costs) {
    costsByCategory[c.category] = (costsByCategory[c.category] ?? 0) + c.amount
  }

  const grossMargin =
    purchasePrice !== null && salePrice !== null ? salePrice - purchasePrice : null

  const netMargin = grossMargin !== null ? grossMargin - totalCosts : null

  const marginPercentReal =
    netMargin !== null && salePrice !== null && salePrice > 0 ? (netMargin / salePrice) * 100 : null

  const isBelowTarget = marginPercentReal !== null && marginPercentReal < marginPercentTarget

  return {
    purchasePrice,
    salePrice,
    totalCosts,
    costsByCategory,
    grossMargin,
    netMargin,
    marginPercentReal,
    marginPercentTarget,
    isBelowTarget,
  }
}
