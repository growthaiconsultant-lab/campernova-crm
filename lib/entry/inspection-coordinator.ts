import type { Prisma } from '@prisma/client'

export function inspectionCoordinator(db: Prisma.TransactionClient) {
  return db.user.findFirst({
    where: { entryInspectionCoordinator: true, active: true, role: { in: ['ADMIN', 'TALLER'] } },
    select: { id: true, name: true },
  })
}
