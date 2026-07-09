import Link from 'next/link'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { TEMPERATURE_LABELS } from '@/lib/lead-temperature'
import { Eyebrow, EmptyState } from '@/components/redesign'
import { cn } from '@/lib/utils'
import type { LeadTemperature } from '@prisma/client'

/**
 * Pipeline de compra (mockup P1/MP1): kanban del viaje del comprador con
 * columnas DERIVADAS del estado real — Lead → Cualificado → Cita → Oferta →
 * Reserva. Un comprador aparece en su columna más avanzada. Las columnas
 * Cita/Oferta/Reserva se derivan de citas y ofertas (no de un enum único),
 * así que el avance se hace desde la ficha (no drag): kanban de lectura con
 * drill-in, una sola fuente de verdad por entidad.
 */

const TEMP_HEX: Record<LeadTemperature, string> = {
  HOT: '#d64545',
  WARM: '#c9820a',
  COLD: '#8b94a3',
}

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

type ColumnKey = 'lead' | 'cualificado' | 'cita' | 'oferta' | 'reserva'

const COLUMNS: { key: ColumnKey; label: string; accent: string }[] = [
  { key: 'lead', label: 'Lead', accent: '#3a6fd4' },
  { key: 'cualificado', label: 'Cualificado', accent: '#7c3aed' },
  { key: 'cita', label: 'Cita', accent: '#0e7d6b' },
  { key: 'oferta', label: 'Oferta', accent: '#c9820a' },
  { key: 'reserva', label: 'Reserva', accent: '#1a9d5f' },
]

export default async function PipelinePage() {
  const currentUser = await requireAuth()
  const isAgente = currentUser.role === 'AGENTE'
  const now = new Date()

  const buyers = await db.buyerLead.findMany({
    where: {
      status: { in: ['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION'] },
      ...(isAgente ? { agentId: currentUser.id } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      offers: {
        where: { status: { in: ['PROPUESTA', 'CONTRAOFERTA', 'ACEPTADA'] } },
        select: { status: true, amount: true, depositAmount: true },
      },
      calendarEvents: {
        where: { type: 'CITA', startAt: { gte: now }, status: { notIn: ['CANCELADO', 'NO_SHOW'] } },
        select: { startAt: true },
        orderBy: { startAt: 'asc' },
        take: 1,
      },
      matches: {
        orderBy: { score: 'desc' },
        take: 1,
        include: { vehicle: { select: { brand: true, model: true } } },
      },
    },
  })

  // Columna más avanzada aplicable a cada comprador.
  function columnFor(b: (typeof buyers)[number]): ColumnKey {
    const hasReservation = b.offers.some(
      (o) => o.status === 'ACEPTADA' && o.depositAmount && Number(o.depositAmount) > 0
    )
    if (hasReservation) return 'reserva'
    if (b.offers.length > 0) return 'oferta'
    if (b.calendarEvents.length > 0) return 'cita'
    if (b.status === 'CUALIFICADO' || b.status === 'EN_NEGOCIACION') return 'cualificado'
    return 'lead'
  }

  const byColumn = new Map<ColumnKey, typeof buyers>()
  for (const b of buyers) {
    const col = columnFor(b)
    const list = byColumn.get(col) ?? []
    list.push(b)
    byColumn.set(col, list)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>CRM · Demanda</Eyebrow>
          <h1 className="mt-1 font-hanken text-[23px] font-bold tracking-[-0.02em] text-ink">
            Pipeline de compra
          </h1>
          <p className="mt-1 font-hanken text-[13.5px] text-ink2">
            <b className="text-ink">{buyers.length}</b> comprador{buyers.length === 1 ? '' : 'es'}{' '}
            activo{buyers.length === 1 ? '' : 's'} · el avance se registra desde cada ficha
          </p>
        </div>
        {/* Toggle Lista | Pipeline */}
        <div className="inline-flex overflow-hidden rounded-[9px] border border-line bg-card">
          <Link
            href="/compradores"
            className="px-3 py-[7px] font-hanken text-[12px] font-medium text-ink2 transition-colors hover:bg-canvas"
          >
            Lista
          </Link>
          <span className="border-l border-line bg-brand-tint px-3 py-[7px] font-hanken text-[12px] font-semibold text-brand">
            Pipeline
          </span>
        </div>
      </div>

      {buyers.length === 0 ? (
        <EmptyState
          title="Sin compradores activos en el pipeline"
          description="Cuando haya compradores activos aparecerán aquí por etapa: Lead, Cualificado, Cita, Oferta y Reserva."
          cta={{ label: 'Nuevo comprador', href: '/compradores/nuevo' }}
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const list = byColumn.get(col.key) ?? []
            return (
              <div
                key={col.key}
                className="flex w-[268px] shrink-0 flex-col rounded-[13px] border border-line bg-canvas"
              >
                <div className="flex items-center gap-2 border-b border-line2 px-3 py-2.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: col.accent }}
                    aria-hidden
                  />
                  <span className="font-hanken text-[12.5px] font-semibold text-ink">
                    {col.label}
                  </span>
                  <span className="ml-auto rounded-full bg-track px-2 py-0.5 font-mono text-[11px] font-semibold text-ink2">
                    {list.length}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2.5">
                  {list.length === 0 ? (
                    <p className="rounded-[10px] border border-dashed border-line px-3 py-6 text-center font-hanken text-[12px] text-ink3">
                      Sin tarjetas
                    </p>
                  ) : (
                    list.map((b) => {
                      const bestMatch = b.matches[0]
                      const offerAmount = b.offers[0]?.amount ? Number(b.offers[0].amount) : null
                      const cita = b.calendarEvents[0]?.startAt
                      return (
                        <Link
                          key={b.id}
                          href={`/compradores/${b.id}`}
                          className="hover:border-ink3/40 rounded-[11px] border border-line bg-card p-[11px] shadow-[0_1px_2px_rgba(20,25,34,0.04)] transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-hanken text-[12.5px] font-semibold text-ink">
                              {b.name}
                            </span>
                            {b.temperature && (
                              <span
                                title={TEMPERATURE_LABELS[b.temperature]}
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: TEMP_HEX[b.temperature] }}
                                aria-hidden
                              />
                            )}
                          </div>
                          <div className="mt-1 font-mono text-[10.5px] text-ink3">
                            {b.maxBudget ? `hasta ${EUR(Number(b.maxBudget))}` : 'sin presupuesto'}
                          </div>
                          {col.key === 'oferta' && offerAmount != null && (
                            <div className="mt-1 font-mono text-[11px] font-semibold text-warn">
                              oferta {EUR(offerAmount)}
                            </div>
                          )}
                          {col.key === 'cita' && cita && (
                            <div
                              className={cn('mt-1 font-mono text-[11px] font-semibold text-brand')}
                            >
                              cita{' '}
                              {new Date(cita).toLocaleString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Europe/Madrid',
                              })}
                            </div>
                          )}
                          {bestMatch && (
                            <div className="mt-1.5 truncate font-hanken text-[11px] font-medium text-ink2">
                              ↳ {bestMatch.vehicle.brand} {bestMatch.vehicle.model} ·{' '}
                              <span className="text-brand">{bestMatch.score}</span>
                            </div>
                          )}
                        </Link>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
