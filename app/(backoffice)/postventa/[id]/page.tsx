import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireCanViewPostventa } from '@/lib/auth'
import { CreateTicketForm } from './create-ticket-form'
import { TicketCard, FollowupCard } from './ticket-card'
import { extendWarranty } from '../actions'

export default async function PostventaDetailPage({ params }: { params: { id: string } }) {
  const currentUser = await requireCanViewPostventa()

  const warranty = await db.warranty.findUnique({
    where: { id: params.id },
    include: {
      vehicle: {
        select: {
          id: true,
          brand: true,
          model: true,
          year: true,
          km: true,
          sellerLead: { select: { id: true, name: true } },
        },
      },
      buyerLead: { select: { id: true, name: true, email: true, phone: true } },
      tickets: {
        orderBy: [{ status: 'asc' }, { openedAt: 'desc' }],
      },
      followups: {
        orderBy: { scheduledFor: 'asc' },
      },
    },
  })

  if (!warranty) notFound()

  const endDate = warranty.extendedTo ?? warranty.endDate
  const isExpired = endDate < new Date()
  const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const isAdmin = currentUser.role === 'ADMIN'

  // Progreso de vigencia de la garantía (mockup POST2)
  const totalMs = endDate.getTime() - warranty.startDate.getTime()
  const elapsedMs = Date.now() - warranty.startDate.getTime()
  const progressPct =
    totalMs > 0 ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100))) : 100
  const progressColor = isExpired ? '#8b94a3' : daysLeft <= 60 ? '#c9820a' : '#1a9d5f'

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink2">
        <Link
          href="/postventa"
          className="inline-flex items-center gap-1 transition-colors hover:text-ink"
        >
          <span aria-hidden>‹</span> Postventa
        </Link>
        <span className="text-ink3">/</span>
        <span className="normal-case tracking-normal text-ink3">
          {warranty.vehicle.brand} {warranty.vehicle.model}
        </span>
      </nav>

      {/* Cabecera con progreso de la garantía */}
      <div>
        <h1 className="font-hanken text-[21px] font-bold leading-[1.1] tracking-[-0.01em] text-ink">
          {warranty.vehicle.brand} {warranty.vehicle.model}
        </h1>
        <p className="mt-1 font-hanken text-[13px] text-ink2">{warranty.buyerLead.name}</p>
        <div className="mt-2.5 flex items-center gap-2.5">
          <div className="h-[6px] w-[220px] overflow-hidden rounded-[3px] bg-track">
            <div
              className="h-full"
              style={{ width: `${progressPct}%`, backgroundColor: progressColor }}
            />
          </div>
          <span className="font-hanken text-[11px] font-semibold" style={{ color: progressColor }}>
            {isExpired ? 'Expirada' : `${daysLeft} días restantes`}
          </span>
        </div>
      </div>

      {/* Warranty info */}
      <div className="space-y-4 rounded-xl border border-cn-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Garantía</h2>
            <p className="text-cn-ink-400 text-sm">
              Activada el{' '}
              {warranty.startDate.toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="text-right">
            <p className={`font-semibold ${isExpired ? 'text-red-600' : 'text-green-700'}`}>
              {isExpired ? 'Expirada' : `${daysLeft} días restantes`}
            </p>
            <p className="text-cn-ink-400 text-sm">
              Hasta{' '}
              {endDate.toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {warranty.extendedTo && (
          <p className="text-cn-ink-400 text-xs">
            Ampliada el{' '}
            {warranty.extendedAt?.toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        )}

        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-cn-ink-400">Vehículo</dt>
            <dd className="font-medium">
              <Link
                href={`/vendedores/${warranty.vehicle.sellerLead?.id}`}
                className="text-cn-teal-900 hover:underline"
              >
                {warranty.vehicle.brand} {warranty.vehicle.model} ({warranty.vehicle.year})
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-cn-ink-400">Comprador</dt>
            <dd className="font-medium">
              <Link
                href={`/compradores/${warranty.buyerLead.id}`}
                className="text-cn-teal-900 hover:underline"
              >
                {warranty.buyerLead.name}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-cn-ink-400">Email / Tel</dt>
            <dd>
              <a
                href={`mailto:${warranty.buyerLead.email}`}
                className="text-cn-teal-900 hover:underline"
              >
                {warranty.buyerLead.email}
              </a>
              {warranty.buyerLead.phone && (
                <>
                  {' · '}
                  <a href={`tel:${warranty.buyerLead.phone}`}>{warranty.buyerLead.phone}</a>
                </>
              )}
            </dd>
          </div>
        </dl>

        {isAdmin && (
          <form
            action={async (fd: FormData) => {
              'use server'
              const months = parseInt(fd.get('months') as string, 10)
              if (months > 0) {
                await extendWarranty(warranty.id, months)
              }
            }}
            className="flex items-end gap-3 border-t border-cn-line pt-4"
          >
            <div className="space-y-1">
              <label className="block text-sm font-medium">Ampliar garantía</label>
              <select
                name="months"
                className="h-9 rounded-lg border border-cn-line bg-white px-3 text-sm focus:outline-none"
              >
                <option value="6">+ 6 meses</option>
                <option value="12">+ 12 meses</option>
                <option value="24">+ 24 meses</option>
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90"
            >
              Ampliar
            </button>
          </form>
        )}
      </div>

      {/* Tickets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Tickets ({warranty.tickets.length})</h2>
          <CreateTicketForm warrantyId={warranty.id} />
        </div>

        {warranty.tickets.length === 0 ? (
          <p className="text-cn-ink-400 text-sm">No hay tickets de incidencia.</p>
        ) : (
          <div className="space-y-3">
            {warranty.tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>

      {/* Follow-ups */}
      <div className="space-y-4">
        <h2 className="font-semibold">Follow-ups automáticos</h2>
        {warranty.followups.length === 0 ? (
          <p className="text-cn-ink-400 text-sm">No hay follow-ups programados.</p>
        ) : (
          <div className="space-y-3">
            {warranty.followups.map((followup) => (
              <FollowupCard key={followup.id} followup={followup} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
