'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Archive, ArrowRight, CalendarDays, Clock3, MessagesSquare } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { LostReason, OfferStatus } from '@prisma/client'
import { groupBuyerOffers, offerDateLabel, offerDay, reservationNotice } from '@/lib/buyer-offers'
import { formatEur } from '@/lib/format/currency'
import { RESERVATION_STALE_DAYS } from '@/lib/kpi/thresholds'
import { LOST_REASON_LABELS } from '@/lib/lost-reason'
import { isReservation, OFFER_STATUS_LABELS } from '@/lib/offers'

export type ListOffer = {
  id: string
  status: OfferStatus
  amount: number
  depositAmount: number | null
  reservedUntil: string | null
  updatedAt: string
  rejectionReason: LostReason | null
  vehicle: string
  buyer: string
  buyerId: string
}

const money = (value: number) => formatEur(value, 'cents')
const nextAction: Record<OfferStatus, string> = {
  PROPUESTA: 'Registrar respuesta',
  CONTRAOFERTA: 'Revisar respuesta',
  ACEPTADA: 'Revisar acuerdo',
  CONVERTIDA: 'Ver cierre',
  RECHAZADA: 'Ver cierre',
  CANCELADA: 'Ver cierre',
  EXPIRADA: 'Ver cierre',
  RETIRADA: 'Ver cierre',
}

function OfferGroup({
  title,
  icon: Icon,
  rows,
  today,
  urgent = false,
}: {
  title: string
  icon: LucideIcon
  rows: ListOffer[]
  today: string
  urgent?: boolean
}) {
  if (!rows.length) return null
  return (
    <section aria-label={title}>
      <h2
        className={
          'mb-2 flex items-center gap-2 text-base font-semibold ' +
          (urgent ? 'text-amber-800 dark:text-amber-300' : 'text-ink')
        }
      >
        <Icon size={17} aria-hidden />
        {title}
      </h2>
      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {rows.map((o) => {
          const reserved = isReservation(o.status, o.depositAmount)
          const notice =
            reserved && o.reservedUntil ? reservationNotice(o.reservedUntil, today) : null
          const status = reserved
            ? 'Reserva'
            : o.status === 'ACEPTADA'
              ? 'Aceptada sin señal'
              : OFFER_STATUS_LABELS[o.status]
          let action = nextAction[o.status]
          if (reserved)
            action =
              notice === 'Vence hoy'
                ? 'Confirmar continuidad'
                : notice
                  ? 'Revisar reserva'
                  : 'Ver reserva'
          return (
            <li
              key={o.id}
              className="grid grid-cols-2 items-center gap-x-3 gap-y-2 px-3 py-3 sm:px-4 lg:grid-cols-[1.5fr_1fr_1.25fr_auto]"
            >
              <div className="min-w-0 break-words">
                <p className="font-semibold text-ink">{o.vehicle}</p>
                <p className="text-sm text-ink2">
                  {o.buyer} · #{o.id.slice(-4).toUpperCase()}
                </p>
              </div>
              <div>
                <p className="font-semibold tabular-nums">{money(o.amount)}</p>
                <p className="text-xs text-ink2">
                  {o.depositAmount !== null
                    ? 'Señal · ' + money(o.depositAmount)
                    : o.status === 'ACEPTADA'
                      ? 'Sin señal registrada'
                      : 'Importe ofertado'}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold">{status}</p>
                {o.reservedUntil ? (
                  <p
                    className={
                      notice
                        ? 'text-xs font-semibold text-amber-800 dark:text-amber-300'
                        : 'text-xs text-ink2'
                    }
                  >
                    {notice || (reserved ? 'Hasta' : 'Plazo registrado')} ·{' '}
                    <time dateTime={o.reservedUntil}>{offerDateLabel(o.reservedUntil)}</time>
                  </p>
                ) : (
                  <p className="text-xs text-ink2">
                    {reserved
                      ? 'Sin fecha acordada'
                      : 'Actualizada · ' + offerDateLabel(o.updatedAt)}
                  </p>
                )}
                {o.status === 'RECHAZADA' && o.rejectionReason && (
                  <p className="text-xs text-ink2">
                    Motivo · {LOST_REASON_LABELS[o.rejectionReason]}
                  </p>
                )}
              </div>
              <Link
                prefetch={false}
                href={'/compradores/' + o.buyerId + '?tab=vehiculos#oferta-' + o.id}
                className="inline-flex min-h-11 items-center gap-1 justify-self-start rounded-md bg-brand-tint px-2.5 py-1.5 text-sm font-semibold text-brand hover:underline lg:justify-self-end"
              >
                {action}
                <ArrowRight size={14} aria-hidden className="shrink-0" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function OffersList({
  rows,
  history,
  initialNow,
}: {
  rows: ListOffer[]
  history: boolean
  initialNow: number
}) {
  const [now, setNow] = useState(initialNow)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const timer = window.setInterval(tick, 60_000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', tick)
    }
  }, [])
  const today = offerDay(new Date(now))
  const { open, reservations, history: closed } = groupBuyerOffers(rows)
  const urgent: ListOffer[] = [],
    later: ListOffer[] = []
  for (const o of reservations) {
    if (o.reservedUntil && reservationNotice(o.reservedUntil, today)) urgent.push(o)
    else later.push(o)
  }
  const pending = open.length + reservations.length
  const sum = [...open, ...reservations].reduce((total, o) => total + o.amount, 0)
  const accepted = rows.filter((o) => o.status === 'ACEPTADA' || o.status === 'CONVERTIDA').length
  const decided = accepted + closed.filter((o) => o.status === 'RECHAZADA').length
  const deposits = reservations.reduce((total, o) => total + (o.depositAmount ?? 0), 0)
  const stalled = reservations.filter(
    (o) =>
      now - Date.parse(o.updatedAt) > RESERVATION_STALE_DAYS * 86_400_000 ||
      (o.reservedUntil && offerDay(new Date(o.reservedUntil)) < today)
  ).length
  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <h1 className="font-hanken text-2xl font-bold tracking-tight text-ink">Ofertas y reservas</h1>
      <nav aria-label="Vistas de ofertas" className="flex flex-wrap gap-1 border-b pb-2">
        {[
          { label: 'Pendientes', url: '/ofertas', count: pending, current: !history },
          {
            label: 'Historial',
            url: '/ofertas?vista=historial',
            count: closed.length,
            current: history,
          },
        ].map((tab) => (
          <Link
            key={tab.url}
            href={tab.url}
            scroll={false}
            aria-current={tab.current ? 'page' : undefined}
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink2 hover:bg-muted aria-[current=page]:bg-brand-tint aria-[current=page]:text-brand"
          >
            {tab.label}
            <span className="font-mono text-xs">{tab.count}</span>
          </Link>
        ))}
      </nav>
      {history ? (
        <OfferGroup title="Operaciones cerradas" icon={Archive} rows={closed} today={today} />
      ) : (
        <>
          <OfferGroup title="Revisar primero" icon={Clock3} rows={urgent} today={today} urgent />
          <OfferGroup title="Ofertas en curso" icon={MessagesSquare} rows={open} today={today} />
          <OfferGroup title="Otras reservas" icon={CalendarDays} rows={later} today={today} />
        </>
      )}
      {(history ? !closed.length : !pending) && (
        <p className="rounded-lg border bg-card p-4 text-sm text-ink2">
          {history
            ? 'Todavía no hay operaciones cerradas.'
            : 'No hay operaciones pendientes. Puedes registrar una oferta desde la ficha del comprador.'}
        </p>
      )}
      <details className="border-t border-line py-3 text-sm text-ink2">
        <summary className="w-fit cursor-pointer font-semibold">Indicadores comerciales</summary>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
          <li>
            {pending} operaciones activas · {money(sum)}
          </li>
          <li>
            {reservations.length} reservas con señal
            {reservations.length > 0 && ' · Señal media ' + money(deposits / reservations.length)}
          </li>
          <li>
            Aceptación ·{' '}
            {decided ? Math.round((100 * accepted) / decided) + ' %' : 'Sin decisiones'}
          </li>
          <li>Reservas paradas · {stalled}</li>
        </ul>
      </details>
    </div>
  )
}
