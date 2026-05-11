import type { VehicleDocumentCategory } from '@prisma/client'

export interface VehicleLegalInput {
  id: string
  plate: string | null
  vin: string | null
  itvValidUntil: Date | null
  chargeCheckedAt: Date | null
  desiredPrice: unknown | null
  purchasePrice: unknown | null
  salePrice: unknown | null
  photoCount: number
  workOrdersBlockingCount: number // EN_CURSO or PENDIENTE
}

export interface DocumentSummary {
  category: VehicleDocumentCategory
  exists: boolean
}

export type TargetStatus = 'TASADO' | 'PUBLICADO'

export interface MissingRequirement {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export const ITV_WARNING_DAYS = 60
