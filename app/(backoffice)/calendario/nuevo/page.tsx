import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { EventForm } from './event-form'

export default async function NuevoEventoPage({
  searchParams,
}: {
  searchParams: { type?: string; buyer?: string; vehicle?: string; seller?: string }
}) {
  await requireAgente()

  const [agents, buyers, vehicles] = await Promise.all([
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.buyerLead.findMany({
      where: { status: { notIn: ['CERRADO', 'PERDIDO'] } },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.vehicle.findMany({
      where: { status: { in: ['TASADO', 'PUBLICADO', 'RESERVADO'] } },
      select: { id: true, brand: true, model: true, year: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/calendario"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Calendario
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Nuevo evento</h1>
      </div>

      <EventForm
        agents={agents.map((a) => ({ id: a.id, label: a.name }))}
        buyers={buyers.map((b) => ({ id: b.id, label: b.name }))}
        vehicles={vehicles.map((v) => ({
          id: v.id,
          label: `${v.brand} ${v.model} (${v.year})`,
        }))}
        defaults={{
          type: searchParams.type,
          buyerLeadId: searchParams.buyer,
          vehicleId: searchParams.vehicle,
          sellerLeadId: searchParams.seller,
        }}
      />
    </div>
  )
}
