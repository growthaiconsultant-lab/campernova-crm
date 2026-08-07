import { z } from 'zod'
import { BED_LAYOUT_VALUES } from '@/lib/rv-taxonomy'

export const RECEPTION_VEHICLE_KIND_VALUES = [
  'MINI_CAMPER',
  'CAMPER',
  'GRAN_VOLUMEN',
  'AUTOCARAVANA_PERFILADA',
  'AUTOCARAVANA_CAPUCHINA',
  'AUTOCARAVANA_INTEGRAL',
  'FURGON_SIN_CAMPERIZAR',
] as const

export const RECEPTION_VEHICLE_KIND_OPTIONS = [
  { value: 'MINI_CAMPER', label: 'Mini camper' },
  { value: 'CAMPER', label: 'Camper' },
  { value: 'GRAN_VOLUMEN', label: 'Gran volumen camperizado' },
  { value: 'AUTOCARAVANA_PERFILADA', label: 'Autocaravana perfilada' },
  { value: 'AUTOCARAVANA_CAPUCHINA', label: 'Autocaravana capuchina' },
  { value: 'AUTOCARAVANA_INTEGRAL', label: 'Autocaravana integral' },
  { value: 'FURGON_SIN_CAMPERIZAR', label: 'Furgón base sin camperizar' },
] as const

export const TRANSMISSION_OPTIONS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'AUTOMATICA', label: 'Automática' },
] as const
export const DRIVETRAIN_OPTIONS = [
  { value: 'DELANTERA', label: 'Delantera' },
  { value: 'TRASERA', label: 'Trasera' },
  { value: 'CUATRO_POR_CUATRO', label: '4×4' },
] as const
export const FUEL_OPTIONS = [
  { value: 'DIESEL', label: 'Diésel' },
  { value: 'GASOLINA', label: 'Gasolina' },
  { value: 'HIBRIDO', label: 'Híbrido' },
  { value: 'ELECTRICO', label: 'Eléctrico' },
] as const
export const ACCESS_STEP_OPTIONS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'ELECTRICO', label: 'Eléctrico' },
  { value: 'NINGUNO', label: 'No tiene' },
] as const
export const LIFT_BED_OPTIONS = [
  { value: 'ELECTRICA', label: 'Eléctrica' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'NINGUNA', label: 'No tiene' },
] as const
export const SWIVEL_SEAT_OPTIONS = [
  { value: 'CONDUCTOR', label: 'Conductor' },
  { value: 'PASAJERO', label: 'Pasajero' },
  { value: 'AMBOS', label: 'Ambos' },
  { value: 'NINGUNO', label: 'Ninguno' },
] as const
export const DINING_TABLE_OPTIONS = [
  { value: 'FIJA', label: 'Fija' },
  { value: 'PLEGABLE', label: 'Plegable' },
  { value: 'EXTRAIBLE', label: 'Extraíble' },
] as const
export const CAB_BLACKOUT_OPTIONS = [
  { value: 'REMIS', label: 'Remis' },
  { value: 'AISLANTE_NUEVE_CAPAS', label: 'Aislante 9 capas con ventosas' },
  { value: 'NINGUNO', label: 'No tiene' },
] as const
export const FRIDGE_OPTIONS = [
  { value: 'COMPRESOR', label: 'Compresor' },
  { value: 'ABSORCION_TRIVALENTE', label: 'Absorción trivalente' },
  { value: 'NINGUNA', label: 'No tiene' },
] as const
export const AUX_BATTERY_OPTIONS = [
  { value: 'GEL_AGM', label: 'Gel / AGM' },
  { value: 'LITIO', label: 'Litio' },
  { value: 'OTRA', label: 'Otra' },
  { value: 'NINGUNA', label: 'No tiene' },
] as const
export const ELECTRICAL_SYSTEM_OPTIONS = [
  { value: 'V12', label: '12 V' },
  { value: 'V220', label: '220 V' },
  { value: 'AMBOS', label: 'Ambos' },
] as const
export const LIVING_AC_OPTIONS = [
  { value: 'V12', label: '12 V' },
  { value: 'V230', label: '230 V' },
  { value: 'NINGUNO', label: 'No tiene' },
] as const

export const EXTERIOR_CONNECTION_OPTIONS = [
  { value: 'V220', label: '220 V' },
  { value: 'AGUA', label: 'Agua' },
] as const
export const KITCHEN_POWER_OPTIONS = [
  { value: 'GAS', label: 'Gas' },
  { value: 'ELECTRICA', label: 'Eléctrica' },
] as const
export const ENERGY_SOURCE_OPTIONS = [
  { value: 'GAS', label: 'Gas' },
  { value: 'ELECTRICA', label: 'Eléctrica' },
  { value: 'DIESEL', label: 'Diésel' },
] as const
export const INTERIOR_SOCKET_OPTIONS = [
  { value: 'USB', label: 'USB' },
  { value: 'V12', label: '12 V' },
  { value: 'V220', label: '220 V' },
] as const
export const INCLUDED_ACCESSORY_OPTIONS = [
  { value: 'MESA_EXTERIOR', label: 'Mesa exterior' },
  { value: 'SILLAS', label: 'Sillas' },
  { value: 'AVANCE', label: 'Avance' },
  { value: 'CUNAS', label: 'Cuñas' },
  { value: 'OTROS', label: 'Otros' },
] as const

const TRANSMISSION_VALUES = ['MANUAL', 'AUTOMATICA'] as const
const DRIVETRAIN_VALUES = ['DELANTERA', 'TRASERA', 'CUATRO_POR_CUATRO'] as const
const FUEL_VALUES = ['DIESEL', 'GASOLINA', 'HIBRIDO', 'ELECTRICO'] as const
const ACCESS_STEP_VALUES = ['MANUAL', 'ELECTRICO', 'NINGUNO'] as const
const LIFT_BED_VALUES = ['ELECTRICA', 'MANUAL', 'NINGUNA'] as const
const SWIVEL_SEAT_VALUES = ['CONDUCTOR', 'PASAJERO', 'AMBOS', 'NINGUNO'] as const
const DINING_TABLE_VALUES = ['FIJA', 'PLEGABLE', 'EXTRAIBLE'] as const
const CAB_BLACKOUT_VALUES = ['REMIS', 'AISLANTE_NUEVE_CAPAS', 'NINGUNO'] as const
const FRIDGE_VALUES = ['COMPRESOR', 'ABSORCION_TRIVALENTE', 'NINGUNA'] as const
const AUX_BATTERY_VALUES = ['GEL_AGM', 'LITIO', 'OTRA', 'NINGUNA'] as const
const ELECTRICAL_SYSTEM_VALUES = ['V12', 'V220', 'AMBOS'] as const
const LIVING_AC_VALUES = ['V12', 'V230', 'NINGUNO'] as const
const EXTERIOR_CONNECTION_VALUES = ['V220', 'AGUA'] as const
const KITCHEN_POWER_VALUES = ['GAS', 'ELECTRICA'] as const
const ENERGY_SOURCE_VALUES = ['GAS', 'ELECTRICA', 'DIESEL'] as const
const INTERIOR_SOCKET_VALUES = ['USB', 'V12', 'V220'] as const
const INCLUDED_ACCESSORY_VALUES = ['MESA_EXTERIOR', 'SILLAS', 'AVANCE', 'CUNAS', 'OTROS'] as const

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value === '' ? null : value))

const nullableEmail = z
  .string()
  .trim()
  .max(320)
  .nullable()
  .transform((value, ctx) => {
    if (value === '' || value === null) return null
    const result = z.string().email().safeParse(value)
    if (!result.success) {
      ctx.addIssue({ code: 'custom', message: 'Email no válido' })
      return z.NEVER
    }
    return value
  })

const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable()
const nullablePositive = z.number().positive().max(10_000_000).nullable()
const nullableBoolean = z.boolean().nullable()
const isExactIsoDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(`${value}T00:00:00Z`)

  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  )
}
const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .refine((value) => value === null || isExactIsoDate(value), {
    message: 'Fecha no válida',
  })

const uniqueEnumArray = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .array(z.enum(values))
    .max(values.length)
    .refine((items) => new Set(items).size === items.length, 'No se permiten opciones duplicadas')

export const commercialReceptionSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    name: nullableText(200),
    email: nullableEmail,
    phone: nullableText(30),
    receptionDate: nullableDate,
    previousOwners: nullableInt(0, 100),
    maintenanceHistoryAvailable: nullableBoolean,
    saleReason: nullableText(1000),
    minPrice: nullablePositive,
  })
  .strict()

export const technicalReceptionSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    brand: nullableText(120),
    model: nullableText(120),
    modelVersion: nullableText(200),
    year: nullableInt(1980, new Date().getFullYear() + 1),
    vehicleKind: z.enum(RECEPTION_VEHICLE_KIND_VALUES).nullable(),
    bedLayout: z.enum(BED_LAYOUT_VALUES).nullable(),
    engine: nullableText(200),
    powerCv: nullableInt(1, 1500),
    transmission: z.enum(TRANSMISSION_VALUES).nullable(),
    drivetrain: z.enum(DRIVETRAIN_VALUES).nullable(),
    fuelType: z.enum(FUEL_VALUES).nullable(),
    km: nullableInt(0, 10_000_000),
    seats: nullableInt(1, 20),
    sleepingPlaces: nullableInt(0, 20),
    itvValidUntil: nullableDate,
    lastServiceDate: nullableDate,
    externalDamageNotes: nullableText(2000),
    internalDamageNotes: nullableText(2000),
    skylightCount: nullableInt(0, 50),
    windowCount: nullableInt(0, 100),
    hasSideAwning: nullableBoolean,
    hasBikeRack: nullableBoolean,
    accessStepType: z.enum(ACCESS_STEP_VALUES).nullable(),
    hasOutdoorShower: nullableBoolean,
    liftBedType: z.enum(LIFT_BED_VALUES).nullable(),
    hasBunkBeds: nullableBoolean,
    exteriorConnections: uniqueEnumArray(EXTERIOR_CONNECTION_VALUES),
    swivelSeats: z.enum(SWIVEL_SEAT_VALUES).nullable(),
    diningTableType: z.enum(DINING_TABLE_VALUES).nullable(),
    hasInteriorLed: nullableBoolean,
    cabBlackoutType: z.enum(CAB_BLACKOUT_VALUES).nullable(),
    hasMultimediaTv: nullableBoolean,
    fridgeType: z.enum(FRIDGE_VALUES).nullable(),
    kitchenPowerSources: uniqueEnumArray(KITCHEN_POWER_VALUES),
    hasSink: nullableBoolean,
    hasFullBathroom: nullableBoolean,
    hasRemovableCassetteToilet: nullableBoolean,
    freshWaterLiters: nullableInt(0, 5000),
    greyWaterLiters: nullableInt(0, 5000),
    waterHeaterSources: uniqueEnumArray(ENERGY_SOURCE_VALUES),
    heatingSources: uniqueEnumArray(ENERGY_SOURCE_VALUES),
    auxBatteryType: z.enum(AUX_BATTERY_VALUES).nullable(),
    auxBatteryCapacityAh: nullableInt(0, 5000),
    electricalSystem: z.enum(ELECTRICAL_SYSTEM_VALUES).nullable(),
    hasSolarPanel: nullableBoolean,
    solarPowerW: nullableInt(0, 10_000),
    solarRegulatorPowerW: nullableInt(0, 10_000),
    hasInverter: nullableBoolean,
    hasExternal230vConnection: nullableBoolean,
    interiorSockets: uniqueEnumArray(INTERIOR_SOCKET_VALUES),
    hasCabAirConditioning: nullableBoolean,
    livingAirConditioning: z.enum(LIVING_AC_VALUES).nullable(),
    hasFansExtractors: nullableBoolean,
    hasCamperizationHomologation: nullableBoolean,
    hasMaintenanceBook: nullableBoolean,
    declaredKeysCount: nullableInt(0, 10),
    includedAccessories: uniqueEnumArray(INCLUDED_ACCESSORY_VALUES),
    accessoriesOther: nullableText(1000),
    extrasNotes: nullableText(4000),
    additionalObservations: nullableText(4000),
  })
  .strict()

export const reviewReceptionSectionSchema = z
  .object({
    section: z.enum(['commercial', 'technical']),
    expectedRevision: z.number().int().min(0),
  })
  .strict()

export type CommercialReceptionInput = z.infer<typeof commercialReceptionSchema>
export type TechnicalReceptionInput = z.infer<typeof technicalReceptionSchema>
export type ReceptionSection = z.infer<typeof reviewReceptionSectionSchema>['section']

export function validateTechnicalReview(input: TechnicalReceptionInput): string[] {
  const errors: string[] = []
  if (
    input.hasSolarPanel !== true &&
    (input.solarPowerW !== null || input.solarRegulatorPowerW !== null)
  ) {
    errors.push('La potencia solar sólo puede informarse cuando existe placa solar.')
  }
  if (input.auxBatteryType === 'NINGUNA' && input.auxBatteryCapacityAh !== null) {
    errors.push('La capacidad auxiliar no puede informarse si no existe batería auxiliar.')
  }
  const includesOther = input.includedAccessories.includes('OTROS')
  if (includesOther !== (input.accessoriesOther !== null)) {
    errors.push('La opción Otros y su descripción deben informarse juntas.')
  }
  return errors
}
