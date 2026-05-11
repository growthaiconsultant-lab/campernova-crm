import type { PrismaClient } from '@prisma/client'

export async function extendWarranty(
  warrantyId: string,
  additionalMonths: number,
  userId: string,
  db: PrismaClient
): Promise<void> {
  const warranty = await db.warranty.findUnique({
    where: { id: warrantyId },
    select: { endDate: true, extendedTo: true },
  })
  if (!warranty) throw new Error('Warranty not found')

  const base = warranty.extendedTo ?? warranty.endDate
  const newEnd = new Date(base)
  newEnd.setMonth(newEnd.getMonth() + additionalMonths)

  await db.warranty.update({
    where: { id: warrantyId },
    data: { extendedTo: newEnd, extendedAt: new Date(), extendedById: userId },
  })
}
