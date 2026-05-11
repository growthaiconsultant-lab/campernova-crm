import type { PrismaClient, PostventaTicket, TicketStatus } from '@prisma/client'

const TERMINAL: TicketStatus[] = ['CERRADO', 'ANULADO']

export async function getOverdueTickets(db: PrismaClient): Promise<PostventaTicket[]> {
  return db.postventaTicket.findMany({
    where: {
      dueAt: { lt: new Date() },
      status: { notIn: TERMINAL },
    },
    orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
  })
}
