import Link from 'next/link'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import type { TicketStatus } from '@prisma/client'

const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  ABIERTO: 'Abierto',
  EN_PROGRESO: 'En progreso',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
  ANULADO: 'Anulado',
}

const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  ABIERTO: 'bg-red-100 text-red-700',
  EN_PROGRESO: 'bg-yellow-100 text-yellow-700',
  RESUELTO: 'bg-blue-100 text-blue-700',
  CERRADO: 'bg-green-100 text-green-700',
  ANULADO: 'bg-gray-100 text-gray-500',
}

export default async function PostventaPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  await requireAuth()

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Postventa</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filteredWarranties.length} garantías activas
          </p>
        </div>
      </div>

      <form className="flex flex-wrap gap-3">
        <select
          name="status"
          defaultValue={searchParams.status ?? ''}
          className="h-9 rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none"
        >
          <option value="">Todas las garantías</option>
          {ticketStatuses.map((s) => (
            <option key={s} value={s}>
              Tickets: {TICKET_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-lg bg-cn-teal-900 px-4 text-sm font-medium text-white hover:opacity-90"
        >
          Filtrar
        </button>
        {searchParams.status && (
          <a
            href="/postventa"
            className="inline-flex h-9 items-center rounded-lg border border-cn-line px-3 text-sm text-cn-ink-500 hover:bg-cn-cream-50"
          >
            Limpiar
          </a>
        )}
      </form>

      {filteredWarranties.length === 0 ? (
        <div className="rounded-xl border border-cn-line py-16 text-center">
          <p className="text-cn-ink-400 text-sm">No hay garantías activas.</p>
          <p className="mt-1 text-xs text-cn-ink-300">
            Las garantías se activan automáticamente al completar una entrega.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWarranties.map((warranty) => {
            const endDate = warranty.extendedTo ?? warranty.endDate
            const isExpired = endDate < new Date()
            const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

            return (
              <div
                key={warranty.id}
                className="overflow-hidden rounded-xl border border-cn-line bg-white"
              >
                <div className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <Link
                      href={`/postventa/${warranty.id}`}
                      className="text-base font-semibold text-cn-teal-900 hover:underline"
                    >
                      {warranty.vehicle.brand} {warranty.vehicle.model}{' '}
                      <span className="text-cn-ink-400 font-normal">{warranty.vehicle.year}</span>
                    </Link>
                    <p className="mt-0.5 text-sm text-cn-ink-500">{warranty.buyerLead.name}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${isExpired ? 'text-red-600' : 'text-green-700'}`}
                    >
                      {isExpired ? 'Garantía expirada' : `${daysLeft} días restantes`}
                    </p>
                    <p className="text-cn-ink-400 text-xs">
                      Hasta{' '}
                      {endDate.toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {warranty.tickets.length > 0 && (
                  <div className="border-t border-cn-line bg-cn-cream-50 px-5 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-cn-ink-400 text-xs font-medium uppercase tracking-wide">
                        Tickets recientes
                      </span>
                      <span className="text-cn-ink-400 text-xs">
                        {warranty._count.tickets} total
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {warranty.tickets.map((ticket) => (
                        <div key={ticket.id} className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm text-cn-ink-700">{ticket.title}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_COLORS[ticket.status]}`}
                          >
                            {TICKET_STATUS_LABELS[ticket.status]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {warranty.followups.length > 0 && (
                  <div className="border-t border-cn-line px-5 py-3">
                    <span className="text-xs font-medium text-amber-600">
                      {warranty.followups.length} follow-up
                      {warranty.followups.length > 1 ? 's' : ''} pendiente
                      {warranty.followups.length > 1 ? 's' : ''}
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
