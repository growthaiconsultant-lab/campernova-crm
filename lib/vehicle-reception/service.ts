import type { Prisma } from '@prisma/client'
import {
  commercialReceptionSchema,
  reviewReceptionSectionSchema,
  technicalReceptionSchema,
  validateTechnicalReview,
  type CommercialReceptionInput,
  type ReceptionSection,
  type TechnicalReceptionInput,
} from '@/lib/vehicle-reception/contracts'
import {
  buildTechnicalValues,
  fromDateInput,
  fromReceptionVehicleKind,
  isCommercialReviewed,
  isTechnicalReviewed,
  receptionStatus,
} from '@/lib/vehicle-reception/model'

export type ReceptionErrorCode = 'NOT_FOUND' | 'CONFLICT' | 'INVALID_REVIEW' | 'FORBIDDEN_SECTION'

export class ReceptionError extends Error {
  constructor(
    readonly code: ReceptionErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ReceptionError'
  }
}

export function isReceptionError(error: unknown): error is ReceptionError {
  return error instanceof ReceptionError
}

async function getOrCreateQuestionnaire(tx: Prisma.TransactionClient, vehicleId: string) {
  const existing = await tx.vehicleReceptionQuestionnaire.findUnique({ where: { vehicleId } })
  if (existing) return existing
  return tx.vehicleReceptionQuestionnaire.create({ data: { vehicleId } })
}

export async function saveCommercialReceptionTx(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  input: CommercialReceptionInput
) {
  const parsed = commercialReceptionSchema.parse(input)
  const vehicle = await tx.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) throw new ReceptionError('NOT_FOUND', 'Vehículo no encontrado.')

  const q = await getOrCreateQuestionnaire(tx, vehicleId)
  if (q.commercialRevision !== parsed.expectedRevision) {
    throw new ReceptionError('CONFLICT', 'El cuestionario ha cambiado; recarga antes de guardar.')
  }

  const nextRevision = q.commercialRevision + 1
  const updated = await tx.vehicleReceptionQuestionnaire.updateMany({
    where: { vehicleId, commercialRevision: parsed.expectedRevision },
    data: {
      receptionDate: fromDateInput(parsed.receptionDate),
      previousOwners: parsed.previousOwners,
      maintenanceHistoryAvailable: parsed.maintenanceHistoryAvailable,
      saleReason: parsed.saleReason,
      commercialRevision: { increment: 1 },
      commercialReviewedRevision: null,
      commercialReviewedAt: null,
      commercialReviewedById: null,
      completedAt: null,
      completedById: null,
    },
  })
  if (updated.count !== 1) {
    throw new ReceptionError('CONFLICT', 'El cuestionario ha cambiado; recarga antes de guardar.')
  }

  await tx.sellerLead.update({
    where: { id: vehicle.sellerLeadId },
    data: {
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      minPrice: parsed.minPrice,
    },
  })

  return { revision: nextRevision, status: 'BORRADOR' as const }
}

export async function saveTechnicalReceptionTx(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  input: TechnicalReceptionInput
) {
  const parsed = technicalReceptionSchema.parse(input)
  const vehicle = await tx.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
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
    },
  })
  if (!vehicle) throw new ReceptionError('NOT_FOUND', 'Vehículo no encontrado.')

  const q = await getOrCreateQuestionnaire(tx, vehicleId)
  if (q.technicalRevision !== parsed.expectedRevision) {
    throw new ReceptionError('CONFLICT', 'El cuestionario ha cambiado; recarga antes de guardar.')
  }

  const { type, category, camperizationState } = fromReceptionVehicleKind(parsed.vehicleKind)
  const valuationInputsChanged =
    vehicle.brand !== parsed.brand ||
    vehicle.model !== parsed.model ||
    vehicle.year !== parsed.year ||
    vehicle.km !== parsed.km ||
    vehicle.type !== type
  const matchingInputsChanged =
    valuationInputsChanged ||
    vehicle.category !== category ||
    vehicle.bedLayout !== parsed.bedLayout ||
    vehicle.sleepingPlaces !== parsed.sleepingPlaces
  const nextRevision = q.technicalRevision + 1
  const updated = await tx.vehicleReceptionQuestionnaire.updateMany({
    where: { vehicleId, technicalRevision: parsed.expectedRevision },
    data: {
      modelVersion: parsed.modelVersion,
      engine: parsed.engine,
      powerCv: parsed.powerCv,
      transmission: parsed.transmission,
      drivetrain: parsed.drivetrain,
      fuelType: parsed.fuelType,
      lastServiceDate: fromDateInput(parsed.lastServiceDate),
      externalDamageNotes: parsed.externalDamageNotes,
      internalDamageNotes: parsed.internalDamageNotes,
      skylightCount: parsed.skylightCount,
      windowCount: parsed.windowCount,
      hasSideAwning: parsed.hasSideAwning,
      hasBikeRack: parsed.hasBikeRack,
      accessStepType: parsed.accessStepType,
      hasOutdoorShower: parsed.hasOutdoorShower,
      liftBedType: parsed.liftBedType,
      hasBunkBeds: parsed.hasBunkBeds,
      exteriorConnections: parsed.exteriorConnections,
      swivelSeats: parsed.swivelSeats,
      diningTableType: parsed.diningTableType,
      hasInteriorLed: parsed.hasInteriorLed,
      cabBlackoutType: parsed.cabBlackoutType,
      hasMultimediaTv: parsed.hasMultimediaTv,
      fridgeType: parsed.fridgeType,
      kitchenPowerSources: parsed.kitchenPowerSources,
      hasSink: parsed.hasSink,
      hasFullBathroom: parsed.hasFullBathroom,
      hasRemovableCassetteToilet: parsed.hasRemovableCassetteToilet,
      freshWaterLiters: parsed.freshWaterLiters,
      greyWaterLiters: parsed.greyWaterLiters,
      waterHeaterSources: parsed.waterHeaterSources,
      heatingSources: parsed.heatingSources,
      auxBatteryType: parsed.auxBatteryType,
      auxBatteryCapacityAh: parsed.auxBatteryCapacityAh,
      electricalSystem: parsed.electricalSystem,
      hasSolarPanel: parsed.hasSolarPanel,
      solarPowerW: parsed.solarPowerW,
      solarRegulatorPowerW: parsed.solarRegulatorPowerW,
      hasInverter: parsed.hasInverter,
      hasExternal230vConnection: parsed.hasExternal230vConnection,
      interiorSockets: parsed.interiorSockets,
      hasCabAirConditioning: parsed.hasCabAirConditioning,
      livingAirConditioning: parsed.livingAirConditioning,
      hasFansExtractors: parsed.hasFansExtractors,
      hasCamperizationHomologation: parsed.hasCamperizationHomologation,
      hasMaintenanceBook: parsed.hasMaintenanceBook,
      declaredKeysCount: parsed.declaredKeysCount,
      includedAccessories: parsed.includedAccessories,
      accessoriesOther: parsed.accessoriesOther,
      extrasNotes: parsed.extrasNotes,
      additionalObservations: parsed.additionalObservations,
      technicalRevision: { increment: 1 },
      technicalReviewedRevision: null,
      technicalReviewedAt: null,
      technicalReviewedById: null,
      completedAt: null,
      completedById: null,
    },
  })
  if (updated.count !== 1) {
    throw new ReceptionError('CONFLICT', 'El cuestionario ha cambiado; recarga antes de guardar.')
  }

  await tx.vehicle.update({
    where: { id: vehicleId },
    data: {
      brand: parsed.brand,
      model: parsed.model,
      year: parsed.year,
      type,
      category,
      camperizationState,
      bedLayout: parsed.bedLayout,
      km: parsed.km,
      seats: parsed.seats,
      sleepingPlaces: parsed.sleepingPlaces,
      itvValidUntil: fromDateInput(parsed.itvValidUntil),
    },
  })

  return {
    revision: nextRevision,
    status: 'BORRADOR' as const,
    valuationInputsChanged,
    matchingInputsChanged,
  }
}

export async function reviewReceptionSectionTx(
  tx: Prisma.TransactionClient,
  actorId: string,
  vehicleId: string,
  section: ReceptionSection,
  expectedRevision: number
) {
  const parsed = reviewReceptionSectionSchema.parse({ section, expectedRevision })
  const vehicle = await tx.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
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
    },
  })
  if (!vehicle) throw new ReceptionError('NOT_FOUND', 'Vehículo no encontrado.')
  let q = await getOrCreateQuestionnaire(tx, vehicleId)
  const currentRevision =
    parsed.section === 'commercial' ? q.commercialRevision : q.technicalRevision
  if (currentRevision !== parsed.expectedRevision) {
    throw new ReceptionError('CONFLICT', 'El cuestionario ha cambiado; recarga antes de revisar.')
  }

  const alreadyReviewed =
    parsed.section === 'commercial' ? isCommercialReviewed(q) : isTechnicalReviewed(q)
  if (!alreadyReviewed && parsed.section === 'technical') {
    const values = buildTechnicalValues(vehicle, q)
    const reviewErrors = validateTechnicalReview({
      expectedRevision: q.technicalRevision,
      ...values,
    })
    if (reviewErrors.length > 0) {
      throw new ReceptionError('INVALID_REVIEW', reviewErrors.join(' '))
    }
  }

  if (!alreadyReviewed) {
    const now = new Date()
    q = await tx.vehicleReceptionQuestionnaire.update({
      where: { vehicleId },
      data:
        parsed.section === 'commercial'
          ? {
              commercialReviewedRevision: q.commercialRevision,
              commercialReviewedAt: now,
              commercialReviewedById: actorId,
            }
          : {
              technicalReviewedRevision: q.technicalRevision,
              technicalReviewedAt: now,
              technicalReviewedById: actorId,
            },
    })
  }

  const complete = isCommercialReviewed(q) && isTechnicalReviewed(q)
  if (complete && q.completedAt === null) {
    q = await tx.vehicleReceptionQuestionnaire.update({
      where: { vehicleId },
      data: { completedAt: new Date(), completedById: actorId },
    })
  }

  return {
    status: receptionStatus(q),
    completedAt: q.completedAt?.toISOString() ?? null,
    commercialReviewed: isCommercialReviewed(q),
    technicalReviewed: isTechnicalReviewed(q),
  }
}
