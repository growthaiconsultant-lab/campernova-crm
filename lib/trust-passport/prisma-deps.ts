import type { PrismaClient } from '@prisma/client'
import type { TrustPassportInput } from './index'

/**
 * Construye el input del Trust Passport para un vehículo agregando su expediente
 * legal (campos + documentos) y el checklist del **último** parte de taller.
 * No persiste nada: el pasaporte se calcula en lectura.
 */
export async function getTrustPassportInput(
  db: PrismaClient,
  vehicleId: string
): Promise<TrustPassportInput | null> {
  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      vin: true,
      itvValidUntil: true,
      chargeCheckedAt: true,
      titleTransferredAt: true,
      documents: { select: { category: true } },
      workOrders: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { checklist: { select: { category: true, result: true } } },
      },
    },
  })
  if (!vehicle) return null

  const latest = vehicle.workOrders[0]
  return {
    vin: vehicle.vin,
    itvValidUntil: vehicle.itvValidUntil,
    chargeCheckedAt: vehicle.chargeCheckedAt,
    titleTransferredAt: vehicle.titleTransferredAt,
    docs: vehicle.documents.map((d) => ({ category: d.category, exists: true })),
    hasWorkOrder: !!latest,
    technicalChecks: latest?.checklist ?? [],
  }
}
