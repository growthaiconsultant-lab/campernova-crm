import type { Vehicle, VehiclePhoto } from '@prisma/client'

export type VehicleWithRelations = Vehicle & {
  photos: VehiclePhoto[]
}

export function buildVehicleContext(vehicle: VehicleWithRelations): string {
  const equipment = (vehicle.equipment ?? {}) as Record<string, boolean>

  const data: Record<string, unknown> = {
    marca: vehicle.brand,
    modelo: vehicle.model,
    año: vehicle.year,
    kilómetros: vehicle.km,
    plazas: vehicle.seats,
    longitud_m: vehicle.length,
    tipo: vehicle.type,
    estado_conservación: vehicle.conservationState,
    ubicación: vehicle.location || 'Parets del Vallès, Barcelona',
    precio_solicitado: vehicle.desiredPrice ? Number(vehicle.desiredPrice) : null,
    equipamiento: Object.keys(equipment).length > 0 ? equipment : null,
    notas_agente: vehicle.publicNotes,
  }

  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '')
  )

  return `Datos del vehículo a anunciar:\n\n${JSON.stringify(clean, null, 2)}`
}
