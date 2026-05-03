import type { PrismaClient } from '@prisma/client'
import type {
  ComparableSale,
  ReferencePriceData,
  ValuationDeps,
  ValuationVehicleInput,
} from './types'

const YEAR_TOLERANCE = 2
const KM_TOLERANCE_PCT = 0.2

/// Implementación real de las dependencias del algoritmo, usando Prisma.
/// Los unit tests usan una versión mock; la app pasa este wrapper.
export function prismaValuationDeps(db: PrismaClient): ValuationDeps {
  return {
    async findComparables(input: ValuationVehicleInput): Promise<ComparableSale[]> {
      const minKm = Math.floor(input.km * (1 - KM_TOLERANCE_PCT))
      const maxKm = Math.ceil(input.km * (1 + KM_TOLERANCE_PCT))

      const rows = await db.vehicle.findMany({
        where: {
          status: 'VENDIDO',
          brand: input.brand,
          model: input.model,
          type: input.type,
          year: { gte: input.year - YEAR_TOLERANCE, lte: input.year + YEAR_TOLERANCE },
          km: { gte: minKm, lte: maxKm },
          desiredPrice: { not: null },
        },
        select: { id: true, year: true, km: true, desiredPrice: true },
        take: 50,
      })

      return rows
        .filter((r) => r.desiredPrice !== null)
        .map((r) => ({
          id: r.id,
          year: r.year,
          km: r.km,
          price: Number(r.desiredPrice),
        }))
    },

    async findReferencePrice(input: ValuationVehicleInput): Promise<ReferencePriceData | null> {
      const rows = await db.referencePrice.findMany({
        where: {
          brand: input.brand,
          model: input.model,
          type: input.type,
        },
      })

      if (rows.length === 0) return null

      // Pick the entry whose baseYear is closest to the vehicle's year.
      const closest = rows.reduce((best, row) =>
        Math.abs(row.baseYear - input.year) < Math.abs(best.baseYear - input.year) ? row : best
      )

      return {
        brand: closest.brand,
        model: closest.model,
        type: closest.type,
        baseYear: closest.baseYear,
        basePrice: Number(closest.basePrice),
        depreciationPerKm: Number(closest.depreciationPerKm),
      }
    },
  }
}
