import type { PrismaClient, PhotoCategory } from '@prisma/client'
import type { VehicleLegalInput, DocumentSummary } from './types'

/** Conteo de fotos por categoría inicializado a 0 (las fotos sin categoría no suman). */
function emptyPhotosByCategory(): Record<PhotoCategory, number> {
  return { EXTERIOR: 0, INTERIOR: 0, DETALLE: 0, DOCUMENTAL: 0 }
}

export async function getVehicleLegalInput(
  db: PrismaClient,
  vehicleId: string
): Promise<VehicleLegalInput | null> {
  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      plate: true,
      vin: true,
      itvValidUntil: true,
      chargeCheckedAt: true,
      desiredPrice: true,
      purchasePrice: true,
      salePrice: true,
      photos: { select: { category: true } },
      workOrders: {
        where: { status: { in: ['PENDIENTE', 'EN_DIAGNOSTICO', 'PRESUPUESTADA', 'EN_CURSO'] } },
        select: { id: true },
      },
    },
  })

  if (!vehicle) return null

  const photosByCategory = emptyPhotosByCategory()
  for (const p of vehicle.photos) {
    if (p.category) photosByCategory[p.category]++
  }

  return {
    id: vehicle.id,
    plate: vehicle.plate,
    vin: vehicle.vin,
    itvValidUntil: vehicle.itvValidUntil,
    chargeCheckedAt: vehicle.chargeCheckedAt,
    desiredPrice: vehicle.desiredPrice,
    purchasePrice: vehicle.purchasePrice,
    salePrice: vehicle.salePrice,
    photoCount: vehicle.photos.length,
    photosByCategory,
    workOrdersBlockingCount: vehicle.workOrders.length,
  }
}

export async function getVehicleDocumentSummary(
  db: PrismaClient,
  vehicleId: string
): Promise<DocumentSummary[]> {
  const docs = await db.vehicleDocument.findMany({
    where: { vehicleId },
    select: { category: true },
  })
  const categories = new Set(docs.map((d) => d.category))

  const allCategories: DocumentSummary['category'][] = [
    'DNI_VENDEDOR',
    'CONTRATO_COMPRAVENTA',
    'FICHA_TECNICA',
    'PERMISO_CIRCULACION',
    'ITV_VIGENTE',
    'JUSTIFICANTE_PAGO',
    'INFORME_CARGAS_DGT',
    'LIBRO_MANTENIMIENTO',
    'FACTURA_COMPRA_ORIGINAL',
    'CONTRATO_FINAL_VENTA',
    'OTRO',
  ]

  return allCategories.map((cat) => ({ category: cat, exists: categories.has(cat) }))
}
