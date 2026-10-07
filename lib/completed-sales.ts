import type { Prisma } from '@prisma/client'

/** Relación histórica de venta; independiente de elegibilidad comercial y matching. */
export const completedSalesQuery = {
  where: { kind: 'VENTA', status: 'COMPLETADA', buyerLeadId: { not: null } },
  orderBy: [
    { completedAt: { sort: 'desc', nulls: 'last' } },
    { createdAt: 'desc' },
    { id: 'desc' },
  ],
  select: {
    id: true,
    completedAt: true,
    vehicle: {
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        plate: true,
        sellerLead: { select: { id: true, name: true } },
      },
    },
    buyerLead: { select: { id: true, name: true } },
  },
} satisfies Prisma.DeliveryFindManyArgs

export type CompletedSale = Prisma.DeliveryGetPayload<typeof completedSalesQuery>
