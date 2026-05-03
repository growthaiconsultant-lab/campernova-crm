import type { PrismaClient } from '@prisma/client'
import type { EquipmentFlags } from '../valuation/types'
import type { MatchingBuyerInput, MatchingDeps, MatchingVehicleInput } from './types'

const ELIGIBLE_VEHICLE_STATUSES = ['PUBLICADO', 'TASADO'] as const
const INELIGIBLE_BUYER_STATUSES = ['CERRADO', 'PERDIDO'] as const

const VEHICLE_SELECT = {
  id: true,
  type: true,
  seats: true,
  year: true,
  km: true,
  equipment: true,
  location: true,
  desiredPrice: true,
  valuationRecommended: true,
} as const

const BUYER_SELECT = {
  id: true,
  vehicleType: true,
  minSeats: true,
  maxBudget: true,
  criticalEquipment: true,
  useZone: true,
} as const

type VehicleRow = {
  id: string
  type: MatchingVehicleInput['type']
  seats: number
  year: number
  km: number
  equipment: unknown
  location: string | null
  desiredPrice: { toString(): string } | null
  valuationRecommended: { toString(): string } | null
}

type BuyerRow = {
  id: string
  vehicleType: MatchingBuyerInput['vehicleType']
  minSeats: number | null
  maxBudget: { toString(): string } | null
  criticalEquipment: unknown
  useZone: string | null
}

function toEquipment(value: unknown): EquipmentFlags {
  if (value && typeof value === 'object') return value as EquipmentFlags
  return {}
}

function toNumber(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value)
}

function vehicleRowToInput(row: VehicleRow): MatchingVehicleInput {
  const desired = toNumber(row.desiredPrice)
  const valuation = toNumber(row.valuationRecommended)
  return {
    id: row.id,
    type: row.type,
    seats: row.seats,
    year: row.year,
    km: row.km,
    equipment: toEquipment(row.equipment),
    location: row.location,
    price: desired ?? valuation,
  }
}

function buyerRowToInput(row: BuyerRow): MatchingBuyerInput {
  return {
    id: row.id,
    vehicleType: row.vehicleType,
    minSeats: row.minSeats,
    maxBudget: toNumber(row.maxBudget),
    criticalEquipment: toEquipment(row.criticalEquipment),
    useZone: row.useZone,
  }
}

/// Implementación real de las deps del matching, usando Prisma.
export function prismaMatchingDeps(db: PrismaClient): MatchingDeps {
  return {
    async getVehicle(vehicleId) {
      const row = await db.vehicle.findUnique({
        where: { id: vehicleId },
        select: VEHICLE_SELECT,
      })
      return row ? vehicleRowToInput(row) : null
    },

    async getBuyer(buyerLeadId) {
      const row = await db.buyerLead.findUnique({
        where: { id: buyerLeadId },
        select: BUYER_SELECT,
      })
      return row ? buyerRowToInput(row) : null
    },

    async listEligibleVehicles() {
      const rows = await db.vehicle.findMany({
        where: { status: { in: [...ELIGIBLE_VEHICLE_STATUSES] } },
        select: VEHICLE_SELECT,
      })
      return rows.map(vehicleRowToInput)
    },

    async listEligibleBuyers() {
      const rows = await db.buyerLead.findMany({
        where: { status: { notIn: [...INELIGIBLE_BUYER_STATUSES] } },
        select: BUYER_SELECT,
      })
      return rows.map(buyerRowToInput)
    },
  }
}
