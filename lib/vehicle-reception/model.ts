import type {
  BedLayout,
  CamperizationState,
  VehicleCategory,
  VehicleReceptionQuestionnaire,
  VehicleType,
} from '@prisma/client'
import type {
  CommercialReceptionInput,
  TechnicalReceptionInput,
} from '@/lib/vehicle-reception/contracts'

export type ReceptionStatus = 'BORRADOR' | 'COMPLETADO'

export type CommercialReceptionValues = Omit<CommercialReceptionInput, 'expectedRevision'>
export type TechnicalReceptionValues = Omit<TechnicalReceptionInput, 'expectedRevision'>

export type ReceptionQuestionnaireDto = {
  vehicleId: string
  status: ReceptionStatus
  completedAt: string | null
  canEditCommercial: boolean
  canEditTechnical: boolean
  commercial: {
    revision: number
    reviewed: boolean
    reviewedAt: string | null
    values: CommercialReceptionValues | null
  }
  technical: {
    revision: number
    reviewed: boolean
    reviewedAt: string | null
    values: TechnicalReceptionValues
  }
}

type VehicleKindInput = {
  type: VehicleType | null
  category: VehicleCategory | null
  camperizationState: CamperizationState | null
}

export function toReceptionVehicleKind(
  input: VehicleKindInput
): TechnicalReceptionValues['vehicleKind'] {
  if (input.camperizationState === 'SIN_CAMPERIZAR') return 'FURGON_SIN_CAMPERIZAR'
  if (input.type === 'AUTOCARAVANA') {
    if (input.category === 'PERFILADA') return 'AUTOCARAVANA_PERFILADA'
    if (input.category === 'CAPUCHINA') return 'AUTOCARAVANA_CAPUCHINA'
    if (input.category === 'INTEGRAL') return 'AUTOCARAVANA_INTEGRAL'
    return null
  }
  if (input.type === 'CAMPER') {
    if (input.category === 'MINI_CAMPER') return 'MINI_CAMPER'
    if (input.category === 'GRAN_VOLUMEN') return 'GRAN_VOLUMEN'
    if (input.category === 'CAMPER' || input.category === null) return 'CAMPER'
  }
  return null
}

export function fromReceptionVehicleKind(
  kind: TechnicalReceptionValues['vehicleKind']
): VehicleKindInput {
  switch (kind) {
    case 'MINI_CAMPER':
      return { type: 'CAMPER', category: 'MINI_CAMPER', camperizationState: 'CAMPERIZADO' }
    case 'CAMPER':
      return { type: 'CAMPER', category: 'CAMPER', camperizationState: 'CAMPERIZADO' }
    case 'GRAN_VOLUMEN':
      return { type: 'CAMPER', category: 'GRAN_VOLUMEN', camperizationState: 'CAMPERIZADO' }
    case 'AUTOCARAVANA_PERFILADA':
      return {
        type: 'AUTOCARAVANA',
        category: 'PERFILADA',
        camperizationState: 'CAMPERIZADO',
      }
    case 'AUTOCARAVANA_CAPUCHINA':
      return {
        type: 'AUTOCARAVANA',
        category: 'CAPUCHINA',
        camperizationState: 'CAMPERIZADO',
      }
    case 'AUTOCARAVANA_INTEGRAL':
      return {
        type: 'AUTOCARAVANA',
        category: 'INTEGRAL',
        camperizationState: 'CAMPERIZADO',
      }
    case 'FURGON_SIN_CAMPERIZAR':
      return { type: null, category: null, camperizationState: 'SIN_CAMPERIZAR' }
    case null:
      return { type: null, category: null, camperizationState: null }
  }
}

export function toDateInput(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

export function fromDateInput(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}

type ReceptionReviewState = Pick<
  VehicleReceptionQuestionnaire,
  | 'commercialRevision'
  | 'technicalRevision'
  | 'commercialReviewedRevision'
  | 'technicalReviewedRevision'
>

export function isCommercialReviewed(questionnaire: ReceptionReviewState | null): boolean {
  return (
    questionnaire !== null &&
    questionnaire.commercialReviewedRevision === questionnaire.commercialRevision
  )
}

export function isTechnicalReviewed(questionnaire: ReceptionReviewState | null): boolean {
  return (
    questionnaire !== null &&
    questionnaire.technicalReviewedRevision === questionnaire.technicalRevision
  )
}

export function receptionStatus(questionnaire: ReceptionReviewState | null): ReceptionStatus {
  return isCommercialReviewed(questionnaire) && isTechnicalReviewed(questionnaire)
    ? 'COMPLETADO'
    : 'BORRADOR'
}

type VehicleTechnicalSource = {
  brand: string | null
  model: string | null
  year: number | null
  km: number | null
  seats: number | null
  type: VehicleType | null
  category: VehicleCategory | null
  camperizationState: CamperizationState | null
  bedLayout: BedLayout | null
  sleepingPlaces: number | null
  itvValidUntil: Date | null
}

export function buildTechnicalValues(
  vehicle: VehicleTechnicalSource,
  q: Partial<VehicleReceptionQuestionnaire> | null
): TechnicalReceptionValues {
  return {
    brand: vehicle.brand,
    model: vehicle.model,
    modelVersion: q?.modelVersion ?? null,
    year: vehicle.year,
    vehicleKind: toReceptionVehicleKind(vehicle),
    bedLayout: vehicle.bedLayout,
    engine: q?.engine ?? null,
    powerCv: q?.powerCv ?? null,
    transmission: q?.transmission ?? null,
    drivetrain: q?.drivetrain ?? null,
    fuelType: q?.fuelType ?? null,
    km: vehicle.km,
    seats: vehicle.seats,
    sleepingPlaces: vehicle.sleepingPlaces,
    itvValidUntil: toDateInput(vehicle.itvValidUntil),
    lastServiceDate: toDateInput(q?.lastServiceDate),
    externalDamageNotes: q?.externalDamageNotes ?? null,
    internalDamageNotes: q?.internalDamageNotes ?? null,
    skylightCount: q?.skylightCount ?? null,
    windowCount: q?.windowCount ?? null,
    hasSideAwning: q?.hasSideAwning ?? null,
    hasBikeRack: q?.hasBikeRack ?? null,
    accessStepType: q?.accessStepType ?? null,
    hasOutdoorShower: q?.hasOutdoorShower ?? null,
    liftBedType: q?.liftBedType ?? null,
    hasBunkBeds: q?.hasBunkBeds ?? null,
    exteriorConnections: (q?.exteriorConnections ??
      []) as TechnicalReceptionValues['exteriorConnections'],
    swivelSeats: q?.swivelSeats ?? null,
    diningTableType: q?.diningTableType ?? null,
    hasInteriorLed: q?.hasInteriorLed ?? null,
    cabBlackoutType: q?.cabBlackoutType ?? null,
    hasMultimediaTv: q?.hasMultimediaTv ?? null,
    fridgeType: q?.fridgeType ?? null,
    kitchenPowerSources: (q?.kitchenPowerSources ??
      []) as TechnicalReceptionValues['kitchenPowerSources'],
    hasSink: q?.hasSink ?? null,
    hasFullBathroom: q?.hasFullBathroom ?? null,
    hasRemovableCassetteToilet: q?.hasRemovableCassetteToilet ?? null,
    freshWaterLiters: q?.freshWaterLiters ?? null,
    greyWaterLiters: q?.greyWaterLiters ?? null,
    waterHeaterSources: (q?.waterHeaterSources ??
      []) as TechnicalReceptionValues['waterHeaterSources'],
    heatingSources: (q?.heatingSources ?? []) as TechnicalReceptionValues['heatingSources'],
    auxBatteryType: q?.auxBatteryType ?? null,
    auxBatteryCapacityAh: q?.auxBatteryCapacityAh ?? null,
    electricalSystem: q?.electricalSystem ?? null,
    hasSolarPanel: q?.hasSolarPanel ?? null,
    solarPowerW: q?.solarPowerW ?? null,
    solarRegulatorPowerW: q?.solarRegulatorPowerW ?? null,
    hasInverter: q?.hasInverter ?? null,
    hasExternal230vConnection: q?.hasExternal230vConnection ?? null,
    interiorSockets: (q?.interiorSockets ?? []) as TechnicalReceptionValues['interiorSockets'],
    hasCabAirConditioning: q?.hasCabAirConditioning ?? null,
    livingAirConditioning: q?.livingAirConditioning ?? null,
    hasFansExtractors: q?.hasFansExtractors ?? null,
    hasCamperizationHomologation: q?.hasCamperizationHomologation ?? null,
    hasMaintenanceBook: q?.hasMaintenanceBook ?? null,
    declaredKeysCount: q?.declaredKeysCount ?? null,
    includedAccessories: (q?.includedAccessories ??
      []) as TechnicalReceptionValues['includedAccessories'],
    accessoriesOther: q?.accessoriesOther ?? null,
    extrasNotes: q?.extrasNotes ?? null,
    additionalObservations: q?.additionalObservations ?? null,
  }
}
