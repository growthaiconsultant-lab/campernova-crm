import type { PrismaClient, BuyerLeadStatus, SellerLeadStatus } from '@prisma/client'
import type { DashboardFilter } from '@/lib/dashboard/queries'
import { LOST_REASON_LABELS } from '@/lib/lost-reason'
import { NEXT_ACTION_LABELS } from '@/lib/next-action'
import { BUYER_STATUSES_TERMINAL, SELLER_STATUSES_TERMINAL } from './stage-map'

/**
 * Bloque F1b KPIs — cálculo del Dashboard CRM. Salud comercial: entrada de
 * leads, disciplina (sin dueño / sin próxima acción / tareas vencidas) y
 * motivos de pérdida. Se lee de tablas. Respeta el filtro de agente.
 */

const ACTIVE_BUYER: BuyerLeadStatus[] = ['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION']
const ACTIVE_SELLER: SellerLeadStatus[] = ['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION']

export type LostReasonRow = { label: string; count: number }
export type LeadRow = {
  id: string
  href: string
  name: string
  kind: 'Comprador' | 'Vendedor'
  detail: string
}

export type CrmKpis = {
  newBuyers30d: number
  newSellers30d: number
  leadsWithoutOwner: number
  leadsWithoutNextAction: number
  overdueTasks: number
  lostBuyers: LostReasonRow[]
  lostSellers: LostReasonRow[]
  withoutActionRows: LeadRow[]
  overdueRows: LeadRow[]
}

function groupLost(
  rows: { lostReason: string | null; _count: { _all: number } }[]
): LostReasonRow[] {
  return rows
    .filter((r) => r.lostReason)
    .map((r) => ({
      label: LOST_REASON_LABELS[r.lostReason as keyof typeof LOST_REASON_LABELS] ?? r.lostReason!,
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count)
}

export async function getCrmKpis(db: PrismaClient, filter: DashboardFilter): Promise<CrmKpis> {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const now = new Date()
  const buyerWhere = filter.agentId ? { agentId: filter.agentId } : {}
  const sellerWhere = filter.agentId ? { agentId: filter.agentId } : {}

  const [
    newBuyers30d,
    newSellers30d,
    buyerNoOwner,
    sellerNoOwner,
    buyerNoAction,
    sellerNoAction,
    buyerOverdue,
    sellerOverdue,
    lostBuyerGroups,
    lostSellerGroups,
    withoutActionBuyers,
    withoutActionSellers,
    overdueBuyers,
    overdueSellers,
  ] = await Promise.all([
    db.buyerLead.count({ where: { ...buyerWhere, createdAt: { gte: since30 } } }),
    db.sellerLead.count({ where: { ...sellerWhere, createdAt: { gte: since30 } } }),
    db.buyerLead.count({
      where: { agentId: null, status: { notIn: BUYER_STATUSES_TERMINAL } },
    }),
    db.sellerLead.count({
      where: { agentId: null, status: { notIn: SELLER_STATUSES_TERMINAL } },
    }),
    db.buyerLead.count({
      where: { ...buyerWhere, status: { in: ACTIVE_BUYER }, nextActionType: null },
    }),
    db.sellerLead.count({
      where: { ...sellerWhere, status: { in: ACTIVE_SELLER }, nextActionType: null },
    }),
    db.buyerLead.count({
      where: { ...buyerWhere, status: { in: ACTIVE_BUYER }, nextActionDueAt: { lt: now } },
    }),
    db.sellerLead.count({
      where: { ...sellerWhere, status: { in: ACTIVE_SELLER }, nextActionDueAt: { lt: now } },
    }),
    db.buyerLead.groupBy({
      by: ['lostReason'],
      _count: { _all: true },
      where: { ...buyerWhere, status: 'PERDIDO' },
    }),
    db.sellerLead.groupBy({
      by: ['lostReason'],
      _count: { _all: true },
      where: { ...sellerWhere, status: 'DESCARTADO' },
    }),
    db.buyerLead.findMany({
      where: { ...buyerWhere, status: { in: ACTIVE_BUYER }, nextActionType: null },
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: 'asc' },
      take: 8,
    }),
    db.sellerLead.findMany({
      where: { ...sellerWhere, status: { in: ACTIVE_SELLER }, nextActionType: null },
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: 'asc' },
      take: 8,
    }),
    db.buyerLead.findMany({
      where: { ...buyerWhere, status: { in: ACTIVE_BUYER }, nextActionDueAt: { lt: now } },
      select: { id: true, name: true, nextActionType: true, nextActionDueAt: true },
      orderBy: { nextActionDueAt: 'asc' },
      take: 8,
    }),
    db.sellerLead.findMany({
      where: { ...sellerWhere, status: { in: ACTIVE_SELLER }, nextActionDueAt: { lt: now } },
      select: { id: true, name: true, nextActionType: true, nextActionDueAt: true },
      orderBy: { nextActionDueAt: 'asc' },
      take: 8,
    }),
  ])

  const fmtDue = (d: Date | null) =>
    d
      ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })
      : '—'

  const withoutActionRows: LeadRow[] = [
    ...withoutActionBuyers.map((b) => ({
      id: `b-${b.id}`,
      href: `/compradores/${b.id}`,
      name: b.name,
      kind: 'Comprador' as const,
      detail: 'Sin próxima acción',
    })),
    ...withoutActionSellers.map((s) => ({
      id: `s-${s.id}`,
      href: `/vendedores/${s.id}`,
      name: s.name,
      kind: 'Vendedor' as const,
      detail: 'Sin próxima acción',
    })),
  ].slice(0, 10)

  const overdueRows: LeadRow[] = [
    ...overdueBuyers.map((b) => ({
      id: `b-${b.id}`,
      href: `/compradores/${b.id}`,
      name: b.name,
      kind: 'Comprador' as const,
      detail: `${b.nextActionType ? (NEXT_ACTION_LABELS[b.nextActionType] ?? b.nextActionType) : 'Acción'} · vencía ${fmtDue(b.nextActionDueAt)}`,
    })),
    ...overdueSellers.map((s) => ({
      id: `s-${s.id}`,
      href: `/vendedores/${s.id}`,
      name: s.name,
      kind: 'Vendedor' as const,
      detail: `${s.nextActionType ? (NEXT_ACTION_LABELS[s.nextActionType] ?? s.nextActionType) : 'Acción'} · vencía ${fmtDue(s.nextActionDueAt)}`,
    })),
  ].slice(0, 10)

  return {
    newBuyers30d,
    newSellers30d,
    leadsWithoutOwner: buyerNoOwner + sellerNoOwner,
    leadsWithoutNextAction: buyerNoAction + sellerNoAction,
    overdueTasks: buyerOverdue + sellerOverdue,
    lostBuyers: groupLost(lostBuyerGroups),
    lostSellers: groupLost(lostSellerGroups),
    withoutActionRows,
    overdueRows,
  }
}
