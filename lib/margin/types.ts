import type { VehicleCostCategory } from '@prisma/client'

export interface VehicleMarginInput {
  purchasePrice: number | null
  salePrice: number | null
  marginPercentTarget: number
  costs: { category: VehicleCostCategory; amount: number }[]
}

export interface VehicleMarginOutput {
  purchasePrice: number | null
  salePrice: number | null
  totalCosts: number
  costsByCategory: Partial<Record<VehicleCostCategory, number>>
  grossMargin: number | null // salePrice - purchasePrice
  netMargin: number | null // grossMargin - totalCosts
  marginPercentReal: number | null // netMargin / salePrice * 100
  marginPercentTarget: number
  isBelowTarget: boolean
}
