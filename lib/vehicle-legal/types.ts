import type { VehicleDocumentCategory, PhotoCategory } from '@prisma/client'

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
  // PUB-1: conteo de fotos por categoría (las sin categoría no suman a ninguna). Alimenta el gate
  // de cobertura fotográfica cuando el flag `PUBLICACION_REQUIERE_FOTOS_CATEGORIZADAS` está activo.
  // Opcional: `getVehicleLegalInput` siempre lo aporta; los constructores de solo-visualización
  // (que no usan el gate de categorías) pueden omitirlo. El gate lo trata como 0 si falta.
  photosByCategory?: Record<PhotoCategory, number>
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
