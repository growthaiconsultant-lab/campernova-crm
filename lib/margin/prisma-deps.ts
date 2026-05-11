import type { PrismaClient } from '@prisma/client'
import { calculateVehicleMargin } from './calculate'
import type { VehicleMarginOutput } from './types'

export async function getVehicleMargin(
  vehicleId: string,
  db: PrismaClient
): Promise<VehicleMarginOutput | null> {
  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      purchasePrice: true,
      salePrice: true,
      marginPercent: true,
      costs: { select: { category: true, amount: true } },
    },
  })

  if (!vehicle) return null

  return calculateVehicleMargin({
    purchasePrice: vehicle.purchasePrice ? Number(vehicle.purchasePrice) : null,
    salePrice: vehicle.salePrice ? Number(vehicle.salePrice) : null,
    marginPercentTarget: Number(vehicle.marginPercent),
    costs: vehicle.costs.map((c) => ({
      category: c.category,
      amount: Number(c.amount),
    })),
  })
}
