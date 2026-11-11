import type { VehicleStatus } from '@prisma/client'

export type PublicAvailability = 'Disponible' | 'Reservado' | 'Vendido'

export function webAvailability(
  status: VehicleStatus,
  publishedAt: Date | null
): PublicAvailability | null {
  if (status === 'PUBLICADO') return 'Disponible'
  if (!publishedAt) return null
  if (status === 'RESERVADO') return 'Reservado'
  if (status === 'VENDIDO') return 'Vendido'
  return null
}
