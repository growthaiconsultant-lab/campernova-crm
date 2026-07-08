import type { PrismaClient, BuyerLeadStatus, SellerLeadStatus } from '@prisma/client'
import { NEXT_ACTION_LABELS } from '@/lib/next-action'

/**
 * Bloque F5 KPIs — Dashboard Comercial (día a día). Orientado a la acción del
 * comercial: su día (tareas, citas), oportunidades calientes y reservas en
 * riesgo, con una lista priorizada. Lectura. Se filtra por el agente indicado.
 */

const ACTIVE_BUYER: BuyerLeadStatus[] = ['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION']
const ACTIVE_SELLER: SellerLeadStatus[] = ['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION']

export type ActionRow = {
  id: string
  href: string
  name: string
  reason: string
  priority: 'red' | 'amber' | 'green'
}

export type ComercialKpis = {
  tasksToday: number
  overdueTasks: number
  appointmentsToday: number
  hotBuyers: number
  activeReservations: number
  priorityRows: ActionRow[]
  hotRows: ActionRow[]
  reservationRows: ActionRow[]
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

export async function getComercialKpis(
  db: PrismaClient,
  agentId: string | null
): Promise<ComercialKpis> {
  const now = new Date()
  const dayStart = startOfToday()
  const dayEnd = endOfToday()
  const buyerWhere = agentId ? { agentId } : {}
  const sellerWhere = agentId ? { agentId } : {}

  const [
    buyerTasksToday,
    sellerTasksToday,
    buyerOverdue,
    sellerOverdue,
    appointmentsToday,
    hotBuyers,
    reservations,
    overdueBuyerRows,
    hotBuyerRows,
  ] = await Promise.all([
    db.buyerLead.count({
      where: {
        ...buyerWhere,
        status: { in: ACTIVE_BUYER },
        nextActionDueAt: { gte: dayStart, lte: dayEnd },
      },
    }),
    db.sellerLead.count({
      where: {
        ...sellerWhere,
        status: { in: ACTIVE_SELLER },
        nextActionDueAt: { gte: dayStart, lte: dayEnd },
      },
    }),
    db.buyerLead.count({
      where: { ...buyerWhere, status: { in: ACTIVE_BUYER }, nextActionDueAt: { lt: now } },
    }),
    db.sellerLead.count({
      where: { ...sellerWhere, status: { in: ACTIVE_SELLER }, nextActionDueAt: { lt: now } },
    }),
    db.calendarEvent.count({
      where: {
        type: 'CITA',
        status: { notIn: ['CANCELADO', 'NO_SHOW', 'COMPLETADO'] },
        startAt: { gte: dayStart, lte: dayEnd },
        ...(agentId ? { assignedToId: agentId } : {}),
      },
    }),
    db.buyerLead.count({
      where: { ...buyerWhere, status: { in: ACTIVE_BUYER }, temperature: 'HOT' },
    }),
    db.offer.findMany({
      where: { status: 'ACEPTADA', depositAmount: { gt: 0 } },
      select: {
        id: true,
        reservedUntil: true,
        vehicle: { select: { brand: true, model: true, sellerLeadId: true } },
        buyerLead: { select: { name: true } },
      },
      orderBy: { reservedUntil: 'asc' },
      take: 20,
    }),
    db.buyerLead.findMany({
      where: { ...buyerWhere, status: { in: ACTIVE_BUYER }, nextActionDueAt: { lt: now } },
      select: { id: true, name: true, nextActionType: true, nextActionDueAt: true },
      orderBy: { nextActionDueAt: 'asc' },
      take: 10,
    }),
    db.buyerLead.findMany({
      where: { ...buyerWhere, status: { in: ACTIVE_BUYER }, temperature: 'HOT' },
      select: { id: true, name: true, maxBudget: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ])

  // Reservas en riesgo (vencen pronto o ya vencidas)
  const reservationRows: ActionRow[] = reservations.map((r) => {
    const days = r.reservedUntil
      ? Math.ceil((r.reservedUntil.getTime() - now.getTime()) / 86_400_000)
      : null
    const priority: ActionRow['priority'] =
      days == null ? 'amber' : days < 0 ? 'red' : days <= 2 ? 'amber' : 'green'
    return {
      id: r.id,
      href: r.vehicle.sellerLeadId ? `/vendedores/${r.vehicle.sellerLeadId}` : '/ofertas',
      name: `${r.buyerLead.name} · ${r.vehicle.brand} ${r.vehicle.model}`,
      reason:
        days == null
          ? 'Reserva sin fecha límite'
          : days < 0
            ? `Reserva vencida hace ${-days}d`
            : `Reserva vence en ${days}d`,
      priority,
    }
  })
  const reservationsAtRisk = reservationRows.filter((r) => r.priority !== 'green')

  const hotRows: ActionRow[] = hotBuyerRows.map((b) => ({
    id: b.id,
    href: `/compradores/${b.id}`,
    name: b.name,
    reason:
      b.maxBudget != null
        ? `Caliente · hasta ${Number(b.maxBudget).toLocaleString('es-ES')} €`
        : 'Comprador caliente',
    priority: 'amber' as const,
  }))

  const overdueRows: ActionRow[] = overdueBuyerRows.map((b) => ({
    id: b.id,
    href: `/compradores/${b.id}`,
    name: b.name,
    reason: `${b.nextActionType ? (NEXT_ACTION_LABELS[b.nextActionType] ?? b.nextActionType) : 'Acción'} vencida`,
    priority: 'red' as const,
  }))

  // Lista priorizada: reservas en riesgo → tareas vencidas → calientes
  const priorityRows: ActionRow[] = [...reservationsAtRisk, ...overdueRows, ...hotRows].slice(0, 15)

  return {
    tasksToday: buyerTasksToday + sellerTasksToday,
    overdueTasks: buyerOverdue + sellerOverdue,
    appointmentsToday,
    hotBuyers,
    activeReservations: reservations.length,
    priorityRows,
    hotRows,
    reservationRows: reservationsAtRisk,
  }
}
