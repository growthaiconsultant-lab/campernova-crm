import { describe, it, expect } from 'vitest'
import { buildVehicleContext } from './build-context'
import type { VehicleWithRelations } from './build-context'
import { VehicleType, ConservationState, VehicleStatus } from '@prisma/client'

function makeVehicle(overrides: Partial<VehicleWithRelations> = {}): VehicleWithRelations {
  return {
    id: 'v1',
    sellerLeadId: 'sl1',
    brand: 'Adria',
    model: 'Matrix 650',
    year: 2019,
    km: 45000,
    seats: 5,
    length: 6.99,
    type: VehicleType.AUTOCARAVANA,
    equipment: { solar: true, kitchen: true, bathroom: false },
    conservationState: ConservationState.BUENO,
    location: 'Barcelona',
    desiredPrice: null,
    publicNotes: null,
    valuationMin: null,
    valuationRecommended: null,
    valuationMax: null,
    status: VehicleStatus.NUEVO,
    publishedAt: null,
    soldAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    photos: [],
    ...overrides,
  }
}

describe('buildVehicleContext', () => {
  it('produces valid JSON with core fields', () => {
    const result = buildVehicleContext(makeVehicle())
    const json = JSON.parse(result.replace('Datos del vehículo a anunciar:\n\n', ''))
    expect(json.marca).toBe('Adria')
    expect(json.modelo).toBe('Matrix 650')
    expect(json.año).toBe(2019)
    expect(json.kilómetros).toBe(45000)
  })

  it('excludes null fields from JSON', () => {
    const result = buildVehicleContext(
      makeVehicle({ desiredPrice: null, publicNotes: null, length: null })
    )
    const json = JSON.parse(result.replace('Datos del vehículo a anunciar:\n\n', ''))
    expect('precio_solicitado' in json).toBe(false)
    expect('notas_agente' in json).toBe(false)
    expect('longitud_m' in json).toBe(false)
  })

  it('excludes empty string fields', () => {
    const vehicle = makeVehicle({ location: '' })
    const result = buildVehicleContext(vehicle)
    const json = JSON.parse(result.replace('Datos del vehículo a anunciar:\n\n', ''))
    // location should fall back to default or be omitted if overrideLocation is ''
    // In this case, location is '' so it should be filtered, but then the default kicks in
    expect(json.ubicación).toBe('Parets del Vallès, Barcelona')
  })

  it('includes desiredPrice as number when set', () => {
    const vehicle = makeVehicle({ desiredPrice: 35000 as unknown as null })
    const result = buildVehicleContext(vehicle)
    const json = JSON.parse(result.replace('Datos del vehículo a anunciar:\n\n', ''))
    expect(json.precio_solicitado).toBe(35000)
  })

  it('includes notas_agente when set', () => {
    const vehicle = makeVehicle({ publicNotes: 'ITV pasada en marzo, toldo Fiamma F45' })
    const result = buildVehicleContext(vehicle)
    const json = JSON.parse(result.replace('Datos del vehículo a anunciar:\n\n', ''))
    expect(json.notas_agente).toBe('ITV pasada en marzo, toldo Fiamma F45')
  })

  it('uses default location when vehicle.location is null', () => {
    const vehicle = makeVehicle({ location: null })
    const result = buildVehicleContext(vehicle)
    const json = JSON.parse(result.replace('Datos del vehículo a anunciar:\n\n', ''))
    expect(json.ubicación).toBe('Parets del Vallès, Barcelona')
  })

  it('omits equipamiento when equipment is empty object', () => {
    const vehicle = makeVehicle({ equipment: {} })
    const result = buildVehicleContext(vehicle)
    const json = JSON.parse(result.replace('Datos del vehículo a anunciar:\n\n', ''))
    expect('equipamiento' in json).toBe(false)
  })

  it('starts with the expected header text', () => {
    const result = buildVehicleContext(makeVehicle())
    expect(result.startsWith('Datos del vehículo a anunciar:')).toBe(true)
  })
})
