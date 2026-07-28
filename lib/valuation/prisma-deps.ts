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
      // CAP-1: sin datos estructurales mínimos no hay comparables posibles (el guard de
      // `calculateValuation` ya lo asegura; esto narra los tipos y protege el arithmetic).
      if (
        input.brand == null ||
        input.model == null ||
        input.type == null ||
        input.year == null ||
        input.km == null
      ) {
        return []
      }
      const km = input.km
      const year = input.year
      const minKm = Math.floor(km * (1 - KM_TOLERANCE_PCT))
      const maxKm = Math.ceil(km * (1 + KM_TOLERANCE_PCT))

      const rows = await db.vehicle.findMany({
        where: {
          status: 'VENDIDO',
          brand: input.brand,
          model: input.model,
          type: input.type,
          year: { gte: year - YEAR_TOLERANCE, lte: year + YEAR_TOLERANCE },
          km: { gte: minKm, lte: maxKm },
          desiredPrice: { not: null },
        },
        select: { id: true, year: true, km: true, desiredPrice: true },
        take: 50,
      })

      return rows
        .filter((r) => r.desiredPrice !== null && r.year !== null && r.km !== null)
        .map((r) => ({
          id: r.id,
          year: r.year as number,
          km: r.km as number,
          price: Number(r.desiredPrice),
        }))
    },

    async findReferencePrice(input: ValuationVehicleInput): Promise<ReferencePriceData | null> {
      if (input.brand == null || input.model == null || input.type == null || input.year == null) {
        return null
      }
      const year = input.year
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
        Math.abs(row.baseYear - year) < Math.abs(best.baseYear - year) ? row : best
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
