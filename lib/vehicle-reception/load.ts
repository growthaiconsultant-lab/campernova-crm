import type { Prisma, User } from '@prisma/client'
import { db } from '@/lib/db'
import {
  buildTechnicalValues,
  isCommercialReviewed,
  isTechnicalReviewed,
  receptionStatus,
  toDateInput,
  type ReceptionQuestionnaireDto,
} from '@/lib/vehicle-reception/model'

export const technicalQuestionnaireSelect = {
  modelVersion: true,
  engine: true,
  powerCv: true,
  transmission: true,
  drivetrain: true,
  fuelType: true,
  lastServiceDate: true,
  externalDamageNotes: true,
  internalDamageNotes: true,
  skylightCount: true,
  windowCount: true,
  hasSideAwning: true,
  hasBikeRack: true,
  accessStepType: true,
  hasOutdoorShower: true,
  liftBedType: true,
  hasBunkBeds: true,
  exteriorConnections: true,
  swivelSeats: true,
  diningTableType: true,
  hasInteriorLed: true,
  cabBlackoutType: true,
  hasMultimediaTv: true,
  fridgeType: true,
  kitchenPowerSources: true,
  hasSink: true,
  hasFullBathroom: true,
  hasRemovableCassetteToilet: true,
  freshWaterLiters: true,
  greyWaterLiters: true,
  waterHeaterSources: true,
  heatingSources: true,
  auxBatteryType: true,
  auxBatteryCapacityAh: true,
  electricalSystem: true,
  hasSolarPanel: true,
  solarPowerW: true,
  solarRegulatorPowerW: true,
  hasInverter: true,
  hasExternal230vConnection: true,
  interiorSockets: true,
  hasCabAirConditioning: true,
  livingAirConditioning: true,
  hasFansExtractors: true,
  hasCamperizationHomologation: true,
  hasMaintenanceBook: true,
  declaredKeysCount: true,
  includedAccessories: true,
  accessoriesOther: true,
  extrasNotes: true,
  additionalObservations: true,
  commercialRevision: true,
  technicalRevision: true,
  commercialReviewedRevision: true,
  technicalReviewedRevision: true,
  technicalReviewedAt: true,
  completedAt: true,
} satisfies Prisma.VehicleReceptionQuestionnaireSelect

const vehicleTechnicalSelect = {
  id: true,
  brand: true,
  model: true,
  year: true,
  km: true,
  seats: true,
  type: true,
  category: true,
  camperizationState: true,
  bedLayout: true,
  sleepingPlaces: true,
  itvValidUntil: true,
} satisfies Prisma.VehicleSelect

export async function loadReceptionQuestionnaire(
  actor: User,
  vehicleId: string
): Promise<ReceptionQuestionnaireDto | null> {
  const canEditCommercial = actor.role === 'ADMIN' || actor.role === 'AGENTE'
  const canEditTechnical = canEditCommercial || actor.role === 'TALLER'
  if (!canEditTechnical) return null

  if (!canEditCommercial) {
    const vehicle = await db.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        ...vehicleTechnicalSelect,
        receptionQuestionnaire: { select: technicalQuestionnaireSelect },
      },
    })
    if (!vehicle) return null
    const q = vehicle.receptionQuestionnaire
    return {
      vehicleId,
      status: receptionStatus(q),
      completedAt: q?.completedAt?.toISOString() ?? null,
      canEditCommercial: false,
      canEditTechnical: true,
      commercial: {
        revision: q?.commercialRevision ?? 0,
        reviewed: isCommercialReviewed(q),
        reviewedAt: null,
        values: null,
      },
      technical: {
        revision: q?.technicalRevision ?? 0,
        reviewed: isTechnicalReviewed(q),
        reviewedAt: q?.technicalReviewedAt?.toISOString() ?? null,
        values: buildTechnicalValues(vehicle, q),
      },
    }
  }

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      ...vehicleTechnicalSelect,
      sellerLead: { select: { name: true, email: true, phone: true, minPrice: true } },
      receptionQuestionnaire: true,
    },
  })
  if (!vehicle) return null
  const q = vehicle.receptionQuestionnaire
  return {
    vehicleId,
    status: receptionStatus(q),
    completedAt: q?.completedAt?.toISOString() ?? null,
    canEditCommercial: true,
    canEditTechnical: true,
    commercial: {
      revision: q?.commercialRevision ?? 0,
      reviewed: isCommercialReviewed(q),
      reviewedAt: q?.commercialReviewedAt?.toISOString() ?? null,
      values: {
        name: vehicle.sellerLead.name,
        email: vehicle.sellerLead.email,
        phone: vehicle.sellerLead.phone,
        receptionDate: toDateInput(q?.receptionDate),
        previousOwners: q?.previousOwners ?? null,
        maintenanceHistoryAvailable: q?.maintenanceHistoryAvailable ?? null,
        saleReason: q?.saleReason ?? null,
        minPrice: vehicle.sellerLead.minPrice ? Number(vehicle.sellerLead.minPrice) : null,
      },
    },
    technical: {
      revision: q?.technicalRevision ?? 0,
      reviewed: isTechnicalReviewed(q),
      reviewedAt: q?.technicalReviewedAt?.toISOString() ?? null,
      values: buildTechnicalValues(vehicle, q),
    },
  }
}
