import { describe, expect, it } from 'vitest'
import {
  commercialReceptionSchema,
  technicalReceptionSchema,
  validateTechnicalReview,
} from './contracts'
import { fromReceptionVehicleKind, receptionStatus, toReceptionVehicleKind } from './model'

const commercial = {
  expectedRevision: 0,
  name: null,
  email: null,
  phone: null,
  receptionDate: null,
  previousOwners: null,
  maintenanceHistoryAvailable: null,
  saleReason: null,
  minPrice: null,
}

const technical = {
  expectedRevision: 0,
  brand: null,
  model: null,
  modelVersion: null,
  year: null,
  vehicleKind: null,
  bedLayout: null,
  engine: null,
  powerCv: null,
  transmission: null,
  drivetrain: null,
  fuelType: null,
  km: null,
  seats: null,
  sleepingPlaces: null,
  itvValidUntil: null,
  lastServiceDate: null,
  externalDamageNotes: null,
  internalDamageNotes: null,
  skylightCount: null,
  windowCount: null,
  hasSideAwning: null,
  hasBikeRack: null,
  accessStepType: null,
  hasOutdoorShower: null,
  liftBedType: null,
  hasBunkBeds: null,
  exteriorConnections: [],
  swivelSeats: null,
  diningTableType: null,
  hasInteriorLed: null,
  cabBlackoutType: null,
  hasMultimediaTv: null,
  fridgeType: null,
  kitchenPowerSources: [],
  hasSink: null,
  hasFullBathroom: null,
  hasRemovableCassetteToilet: null,
  freshWaterLiters: null,
  greyWaterLiters: null,
  waterHeaterSources: [],
  heatingSources: [],
  auxBatteryType: null,
  auxBatteryCapacityAh: null,
  electricalSystem: null,
  hasSolarPanel: null,
  solarPowerW: null,
  solarRegulatorPowerW: null,
  hasInverter: null,
  hasExternal230vConnection: null,
  interiorSockets: [],
  hasCabAirConditioning: null,
  livingAirConditioning: null,
  hasFansExtractors: null,
  hasCamperizationHomologation: null,
  hasMaintenanceBook: null,
  declaredKeysCount: null,
  includedAccessories: [],
  accessoriesOther: null,
  extrasNotes: null,
  additionalObservations: null,
} as const

describe('contratos de recepción', () => {
  it('conserva null como sin responder y false como respuesta negativa', () => {
    const result = commercialReceptionSchema.parse({
      ...commercial,
      maintenanceHistoryAvailable: false,
    })
    expect(result.maintenanceHistoryAvailable).toBe(false)
    expect(result.name).toBeNull()
  })

  it('rechaza fechas de calendario imposibles', () => {
    const result = commercialReceptionSchema.safeParse({
      ...commercial,
      receptionDate: '2026-02-31',
    })

    expect(result.success).toBe(false)
  })

  it('rechaza mass assignment y opciones duplicadas', () => {
    expect(() =>
      commercialReceptionSchema.parse({ ...commercial, purchasePrice: 20_000 })
    ).toThrow()
    expect(() =>
      technicalReceptionSchema.parse({
        ...technical,
        exteriorConnections: ['AGUA', 'AGUA'],
      })
    ).toThrow()
  })

  it('rechaza límites físicos inválidos', () => {
    expect(() => technicalReceptionSchema.parse({ ...technical, declaredKeysCount: 11 })).toThrow()
    expect(() => technicalReceptionSchema.parse({ ...technical, freshWaterLiters: -1 })).toThrow()
  })

  it('permite guardar borrador parcial y exige dependencias al revisar', () => {
    const draft = technicalReceptionSchema.parse({
      ...technical,
      hasSolarPanel: false,
      solarPowerW: 300,
    })
    expect(validateTechnicalReview(draft)).toContain(
      'La potencia solar sólo puede informarse cuando existe placa solar.'
    )
  })
})

describe('taxonomía y estado de recepción', () => {
  it('representa el furgón sin camperizar sin falsear VehicleType', () => {
    expect(fromReceptionVehicleKind('FURGON_SIN_CAMPERIZAR')).toEqual({
      type: null,
      category: null,
      camperizationState: 'SIN_CAMPERIZAR',
    })
    expect(
      toReceptionVehicleKind({
        type: null,
        category: null,
        camperizationState: 'SIN_CAMPERIZAR',
      })
    ).toBe('FURGON_SIN_CAMPERIZAR')
  })

  it('sólo deriva COMPLETADO cuando ambas revisiones están vigentes', () => {
    expect(
      receptionStatus({
        commercialRevision: 2,
        commercialReviewedRevision: 2,
        technicalRevision: 3,
        technicalReviewedRevision: 3,
      })
    ).toBe('COMPLETADO')
    expect(
      receptionStatus({
        commercialRevision: 2,
        commercialReviewedRevision: 1,
        technicalRevision: 3,
        technicalReviewedRevision: 3,
      })
    ).toBe('BORRADOR')
  })
})
