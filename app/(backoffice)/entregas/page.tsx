import Link from 'next/link'
import { Plus, Truck } from 'lucide-react'
import { db } from '@/lib/db'
import { requireCanViewEntregas } from '@/lib/auth'
import { Eyebrow, HexPill, ButtonLink, EmptyState } from '@/components/redesign'
import { cn } from '@/lib/utils'
import type { DeliveryStatus } from '@prisma/client'

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  PROGRAMADA: 'Programada',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
}

// Semáforo del handoff: programada = azul info, en curso = ámbar,
// completada = verde, cancelada = rojo.
const STATUS_HEX: Record<DeliveryStatus, string> = {
  PROGRAMADA: '#3a6fd4',
  EN_CURSO: '#c9820a',
  COMPLETADA: '#1a9d5f',
  CANCELADA: '#d64545',
}

const TZ = 'Europe/Madrid'

function dayKey(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: TZ }) // YYYY-MM-DD en TZ local
}

function dayLabel(d: Date, now: Date): string {
  const key = dayKey(d)
  const todayKey = dayKey(now)
  const tomorrow = new Date(now.getTime() + 86_400_000)
  const yesterday = new Date(now.getTime() - 86_400_000)
  const dateStr = d
    .toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ })
    .toUpperCase()
  if (key === todayKey) return `HOY · ${dateStr}`
  if (key === dayKey(tomorrow)) return `MAÑANA · ${dateStr}`
  if (key === dayKey(yesterday)) return `AYER · ${dateStr}`
  return dateStr
}

export default async function EntregasPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  await requireCanViewEntregas()

  const where: Record<string, unknown> = {}
  if (searchParams.status) where.status = searchParams.status

  const deliveries = await db.delivery.findMany({
    where,
    include: {
      vehicle: { select: { id: true, brand: true, model: true, year: true } },
      buyerLead: { select: { id: true, name: true } },
      responsable: { select: { id: true, name: true } },
      checklist: { select: { result: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  })

  const now = new Date()
  const statuses = Object.keys(STATUS_LABELS) as DeliveryStatus[]

  // Agenda por día (ENT1): agrupar por fecha de cita, próximas primero.
  const groups = new Map<string, typeof deliveries>()
  for (const d of deliveries) {
    const key = dayKey(new Date(d.scheduledAt))
    const list = groups.get(key) ?? []
    list.push(d)
    groups.set(key, list)
  }
  const sortedKeys = Array.from(groups.keys()).sort()
  // Días pasados al final (la agenda mira hacia delante), salvo filtro explícito.
  const todayKey = dayKey(now)
  const upcoming = sortedKeys.filter((k) => k >= todayKey)
  const past = sortedKeys.filter((k) => k < todayKey).reverse()
  const orderedKeys = searchParams.status ? sortedKeys : [...upcoming, ...past]

  const pendingCount = deliveries.filter(
    (d) => d.status === 'PROGRAMADA' || d.status === 'EN_CURSO'
  ).length

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>CRM · Operaciones</Eyebrow>
          <h1 className="mt-1 font-hanken text-[23px] font-bold tracking-[-0.02em] text-ink">
            Entregas
          </h1>
          <p className="mt-1 font-hanken text-[13.5px] text-ink2">
            <b className="text-ink">{pendingCount}</b> pendiente{pendingCount === 1 ? '' : 's'} ·{' '}
            {deliveries.length} en total
          </p>
        </div>
        <ButtonLink href="/entregas/nueva" variant="primary">
          <Plus size={15} strokeWidth={2.2} className="mr-1.5" />
          Nueva entrega
        </ButtonLink>
      </div>

      {/* Filtro por estado */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <Link
          href="/entregas"
          className={cn(
            'inline-flex items-center rounded-[9px] border px-3 py-1.5 font-hanken text-[12.5px] font-semibold transition-colors',
            !searchParams.status
              ? 'border-brand bg-brand-tint text-brand'
              : 'border-line bg-card text-ink2 hover:bg-canvas'
          )}
        >
          Todas
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/entregas?status=${s}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 font-hanken text-[12.5px] font-semibold transition-colors',
              searchParams.status === s
                ? 'border-brand bg-brand-tint text-brand'
                : 'border-line bg-card text-ink2 hover:bg-canvas'
            )}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: STATUS_HEX[s] }}
              aria-hidden
            />
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {deliveries.length === 0 ? (
        <EmptyState
          icon={<Truck size={20} strokeWidth={1.9} />}
          title="Sin entregas programadas"
          description="Aquí verás la agenda de entregas por día, con el progreso del checklist y el responsable. Al completar una entrega se activa la garantía."
          cta={{ label: 'Nueva entrega', href: '/entregas/nueva' }}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {orderedKeys.map((key) => {
            const list = groups.get(key)!
            const label = dayLabel(new Date(list[0].scheduledAt), now)
            return (
              <section key={key}>
                <div className="mb-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink3">
                  {label}
                </div>
                <div className="flex flex-col gap-2.5">
                  {list.map((d) => {
                    const done = d.checklist.filter((c) => c.result !== 'PENDIENTE').length
                    const total = d.checklist.length
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0
                    const checklistColor =
                      total === 0 ? '#8b94a3' : done === total ? '#1a9d5f' : '#c9820a'
                    const time = new Date(d.scheduledAt).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: TZ,
                    })
                    return (
                      <Link
                        key={d.id}
                        href={`/entregas/${d.id}`}
                        className="hover:border-ink3/40 flex items-center gap-4 rounded-[14px] border border-line bg-card p-4 transition-colors"
                      >
                        {/* Hora */}
                        <div className="w-[52px] shrink-0 text-center">
                          <div className="font-hanken text-[18px] font-bold text-ink">{time}</div>
                          <div className="font-hanken text-[10px] font-medium text-ink3">Nave</div>
                        </div>
                        <div className="w-px self-stretch bg-line2" aria-hidden />
                        {/* Vehículo + comprador + checklist */}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-hanken text-[15px] font-bold text-ink">
                            {d.vehicle.brand} {d.vehicle.model} {d.vehicle.year}
                          </div>
                          <div className="mt-0.5 truncate font-hanken text-[12px] font-medium text-ink2">
                            Comprador: {d.buyerLead.name}
                            {d.responsable ? ` · resp. ${d.responsable.name}` : ''}
                          </div>
                          <div className="mt-2 flex items-center gap-2.5">
                            <div className="h-[6px] max-w-[180px] flex-1 overflow-hidden rounded-[3px] bg-track">
                              <div
                                className="h-full"
                                style={{ width: `${pct}%`, backgroundColor: checklistColor }}
                              />
                            </div>
                            <span
                              className="font-hanken text-[11px] font-semibold"
                              style={{ color: checklistColor }}
                            >
                              Checklist {done}/{total}
                            </span>
                          </div>
                        </div>
                        {/* Estado */}
                        <HexPill hex={STATUS_HEX[d.status]} className="shrink-0">
                          {STATUS_LABELS[d.status]}
                        </HexPill>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
