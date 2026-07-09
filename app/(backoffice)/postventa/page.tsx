import Link from 'next/link'
import { Clock, ShieldCheck } from 'lucide-react'
import { db } from '@/lib/db'
import { requireCanViewPostventa } from '@/lib/auth'
import { Eyebrow, HexPill, EmptyState } from '@/components/redesign'
import { cn } from '@/lib/utils'
import type { TicketStatus, FollowupType } from '@prisma/client'

const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  ABIERTO: 'Abierto',
  EN_PROGRESO: 'En progreso',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
  ANULADO: 'Anulado',
}

// Semáforo del handoff: abierto = rojo, en progreso = ámbar, resuelto = azul,
// cerrado = verde, anulado = gris.
const TICKET_STATUS_HEX: Record<TicketStatus, string> = {
  ABIERTO: '#d64545',
  EN_PROGRESO: '#c9820a',
  RESUELTO: '#3a6fd4',
  CERRADO: '#1a9d5f',
  ANULADO: '#8b94a3',
}

const FOLLOWUP_LABELS: Record<FollowupType, string> = {
  DIA_7: 'Follow-up día 7',
  DIA_30: 'Follow-up día 30',
}

const TZ = 'Europe/Madrid'

function deliveredAgo(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return 'entregada hoy'
  if (days === 1) return 'entregada ayer'
  return `entregada hace ${days} días`
}

export default async function PostventaPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  await requireCanViewPostventa()

  const warranties = await db.warranty.findMany({
    include: {
      vehicle: { select: { id: true, brand: true, model: true, year: true } },
      buyerLead: { select: { id: true, name: true } },
      tickets: {
        where: searchParams.status ? { status: searchParams.status as TicketStatus } : undefined,
        orderBy: { openedAt: 'desc' },
        take: 3,
      },
      followups: {
        where: { status: 'PENDIENTE' },
        orderBy: { scheduledFor: 'asc' },
      },
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const filteredWarranties = searchParams.status
    ? warranties.filter((w) => w.tickets.length > 0)
    : warranties

  const ticketStatuses = Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]
  const now = new Date()
  const openTickets = warranties.reduce(
    (s, w) =>
      s + w.tickets.filter((t) => t.status === 'ABIERTO' || t.status === 'EN_PROGRESO').length,
    0
  )
  const pendingFollowups = warranties.reduce((s, w) => s + w.followups.length, 0)

  return (
    <div>
      <div className="mb-4">
        <Eyebrow>CRM · Operaciones</Eyebrow>
        <h1 className="mt-1 font-hanken text-[23px] font-bold tracking-[-0.02em] text-ink">
          Postventa
        </h1>
        <p className="mt-1 font-hanken text-[13.5px] text-ink2">
          <b className="text-ink">{filteredWarranties.length}</b> garantía
          {filteredWarranties.length === 1 ? '' : 's'}
          {openTickets > 0 && (
            <>
              {' '}
              ·{' '}
              <b className="text-bad">
                {openTickets} ticket{openTickets === 1 ? '' : 's'} vivo
                {openTickets === 1 ? '' : 's'}
              </b>
            </>
          )}
          {pendingFollowups > 0 && (
            <>
              {' '}
              · {pendingFollowups} follow-up{pendingFollowups === 1 ? '' : 's'} pendiente
              {pendingFollowups === 1 ? '' : 's'}
            </>
          )}
        </p>
      </div>

      {/* Filtro por estado de ticket */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <Link
          href="/postventa"
          className={cn(
            'inline-flex items-center rounded-[9px] border px-3 py-1.5 font-hanken text-[12.5px] font-semibold transition-colors',
            !searchParams.status
              ? 'border-brand bg-brand-tint text-brand'
              : 'border-line bg-card text-ink2 hover:bg-canvas'
          )}
        >
          Todas
        </Link>
        {ticketStatuses.map((s) => (
          <Link
            key={s}
            href={`/postventa?status=${s}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 font-hanken text-[12.5px] font-semibold transition-colors',
              searchParams.status === s
                ? 'border-brand bg-brand-tint text-brand'
                : 'border-line bg-card text-ink2 hover:bg-canvas'
            )}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: TICKET_STATUS_HEX[s] }}
              aria-hidden
            />
            {TICKET_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {filteredWarranties.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={20} strokeWidth={1.9} />}
          title="Sin garantías que mostrar"
          description="Las garantías se activan automáticamente al completar una entrega. Aquí verás sus días restantes, tickets y follow-ups de los días 7 y 30."
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {filteredWarranties.map((warranty) => {
            const endDate = warranty.extendedTo ?? warranty.endDate
            const isExpired = endDate < now
            const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000)
            const daysColor = isExpired ? '#8b94a3' : daysLeft <= 60 ? '#c9820a' : '#1a9d5f'

            return (
              <div
                key={warranty.id}
                className="overflow-hidden rounded-[14px] border border-line bg-card"
              >
                {/* Cabecera de la garantía */}
                <Link
                  href={`/postventa/${warranty.id}`}
                  className="hover:bg-line2/40 flex items-start justify-between gap-4 p-[18px] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="truncate font-hanken text-[15px] font-bold text-ink">
                      {warranty.vehicle.brand} {warranty.vehicle.model} {warranty.vehicle.year}
                    </div>
                    <div className="mt-0.5 truncate font-hanken text-[12px] font-medium text-ink2">
                      {warranty.buyerLead.name} · {deliveredAgo(warranty.startDate)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {isExpired ? (
                      <span className="rounded-[7px] bg-track px-2.5 py-1 font-hanken text-[11px] font-semibold text-ink2">
                        Garantía expirada
                      </span>
                    ) : (
                      <>
                        <div
                          className="font-hanken text-[13px] font-semibold"
                          style={{ color: daysColor }}
                        >
                          {daysLeft} días restantes
                        </div>
                        <div className="mt-0.5 font-hanken text-[10.5px] font-medium text-ink3">
                          hasta{' '}
                          {endDate.toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            timeZone: TZ,
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </Link>

                {/* Tickets */}
                {warranty.tickets.length > 0 && (
                  <div className="border-t border-line2 bg-canvas px-[18px] py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-ink3">
                        Tickets
                      </span>
                      <span className="font-hanken text-[11px] font-medium text-ink3">
                        {warranty._count.tickets} en total
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {warranty.tickets.map((ticket) => {
                        const overdue =
                          ticket.dueAt &&
                          ticket.dueAt < now &&
                          (ticket.status === 'ABIERTO' || ticket.status === 'EN_PROGRESO')
                        return (
                          <div key={ticket.id} className="flex items-center justify-between gap-3">
                            <span className="truncate font-hanken text-[12.5px] font-medium text-ink">
                              {ticket.title}
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              {overdue && <HexPill hex="#d64545">Vencido · escalar</HexPill>}
                              <HexPill hex={TICKET_STATUS_HEX[ticket.status]}>
                                {TICKET_STATUS_LABELS[ticket.status]}
                              </HexPill>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Follow-ups pendientes */}
                {warranty.followups.length > 0 && (
                  <div className="flex items-center gap-2 border-t border-line2 px-[18px] py-[11px]">
                    <Clock size={14} strokeWidth={2} className="shrink-0 text-warn" />
                    <span className="font-hanken text-[12px] font-semibold text-warn">
                      {FOLLOWUP_LABELS[warranty.followups[0].type]} pendiente
                    </span>
                    <span className="font-hanken text-[11.5px] font-medium text-ink3">
                      · llamada de satisfacción
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
