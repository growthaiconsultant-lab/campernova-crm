import type { Prisma } from '@prisma/client'
import { isTerminalTicketStatus } from '@/lib/postventa/transitions'

const pendingTickets = {
  status: { notIn: ['CERRADO', 'ANULADO'] },
} satisfies Prisma.PostventaTicketWhereInput

export const buyerPostventaSummary = {
  id: true,
  _count: {
    select: { tickets: { where: pendingTickets }, followups: { where: { status: 'FALLIDO' } } },
  },
  tickets: {
    where: pendingTickets,
    take: 2,
    orderBy: [{ priority: 'desc' }, { dueAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
    select: { id: true, title: true },
  },
} satisfies Prisma.WarrantySelect

export const buyerPostventaDetail = {
  ...buyerPostventaSummary,
  startDate: true,
  endDate: true,
  extendedTo: true,
  delivery: { select: { completedAt: true } },
  vehicle: { select: { brand: true, model: true, id: true } },
  tickets: {
    orderBy: buyerPostventaSummary.tickets.orderBy,
    select: {
      id: true,
      title: true,
      priority: true,
      status: true,
      description: true,
      solution: true,
      responsible: { select: { name: true } },
      dueAt: true,
      resolvedAt: true,
      closedAt: true,
      updatedAt: true,
    },
  },
  followups: {
    orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      type: true,
      status: true,
      scheduledFor: true,
      sentAt: true,
      respondedAt: true,
      responseNotes: true,
    },
  },
} satisfies Prisma.WarrantySelect

export type BuyerWarranty = Prisma.WarrantyGetPayload<{ select: typeof buyerPostventaDetail }>

const dateLabel = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Madrid',
})
export function postventaDate(date: Date) {
  return dateLabel.format(date)
}

export function followupTitle(type: BuyerWarranty['followups'][number]['type']) {
  return type === 'DIA_7' ? 'Correo de los 7 días' : 'Correo de los 30 días'
}

export function postventaHistory(warranty: BuyerWarranty) {
  const history: { id: string; date: Date | null; title: string; note?: string | null }[] = []
  for (const ticket of warranty.tickets) {
    if (isTerminalTicketStatus(ticket.status)) {
      const closed = ticket.status === 'CERRADO'
      history.push({
        id: ticket.id,
        date: closed ? (ticket.closedAt ?? ticket.updatedAt) : ticket.updatedAt,
        title: (closed ? 'Incidencia cerrada · ' : 'Incidencia anulada · ') + ticket.title,
        note: ticket.solution,
      })
    }
  }
  for (const followup of warranty.followups) {
    if (followup.status === 'ENVIADO' || followup.status === 'RESPONDIDO') {
      const title = followupTitle(followup.type)
      if (followup.sentAt || followup.status === 'ENVIADO')
        history.push({
          id: followup.id + '-envio',
          date: followup.sentAt,
          title: title + ' · Enviado',
        })
      if (followup.status === 'RESPONDIDO')
        history.push({
          id: followup.id + '-respuesta',
          date: followup.respondedAt,
          title: title + ' · Respuesta registrada',
          note: followup.responseNotes,
        })
    }
  }
  return history.sort(
    (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0) || a.id.localeCompare(b.id)
  )
}
