import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

const inputSchema = z.object({
  vehicleId: z.string().trim().min(1),
  orderedIds: z
    .array(z.string().min(1))
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length),
})

class PhotoOrderConflict extends Error {}

function isTransactionConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  return (
    error.code === 'P2034' ||
    (error.code === 'P2010' && (error.meta?.code === '40001' || error.meta?.code === '40P01'))
  )
}

/** Called only after the server action has authorized the user. */
export async function persistVehiclePhotoOrder(
  database: Pick<PrismaClient, '$transaction'>,
  vehicleId: unknown,
  orderedIds: unknown
): Promise<{ sellerLeadId: string } | { error: string }> {
  const parsed = inputSchema.safeParse({ vehicleId, orderedIds })
  if (!parsed.success) return { error: 'Orden inválido' }
  const input = parsed.data

  try {
    return await database.$transaction(
      async (tx) => {
        const vehicle = await tx.vehicle.findUnique({
          where: { id: input.vehicleId },
          select: { sellerLeadId: true },
        })
        if (!vehicle) return { error: 'Vehículo no encontrado' }
        const photos = await tx.vehiclePhoto.findMany({
          where: { vehicleId: input.vehicleId },
          select: { id: true },
        })
        const existingIds = new Set(photos.map((photo) => photo.id))
        if (
          photos.length !== input.orderedIds.length ||
          !input.orderedIds.every((id) => existingIds.has(id))
        ) {
          return { error: 'IDs no coinciden con las fotos del vehículo' }
        }

        const positions = Prisma.join(
          input.orderedIds.map((id, index) => Prisma.sql`(${id}::text, ${index}::integer)`)
        )
        const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE public.vehicle_photos AS photo
        SET "order" = photo_order.ordinal
        FROM (VALUES ${positions}) AS photo_order(id, ordinal)
        WHERE photo.id = photo_order.id AND photo.vehicle_id = ${input.vehicleId}
      `)
        if (updated !== input.orderedIds.length) throw new PhotoOrderConflict()
        return { sellerLeadId: vehicle.sellerLeadId }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  } catch (error) {
    if (error instanceof PhotoOrderConflict || isTransactionConflict(error)) {
      return { error: 'Las fotos han cambiado. Recarga la ficha y vuelve a ordenar.' }
    }
    throw error
  }
}
