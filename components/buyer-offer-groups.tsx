'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, FileText } from 'lucide-react'
import { groupBuyerOffers, offerDateLabel, offerDay, reservationNotice } from '@/lib/buyer-offers'
import { OFFER_STATUS_LABELS } from '@/lib/offers'
import { formatEur } from '@/lib/format/currency'
import { OfferActions } from './offer-actions'
import type { OfferRow } from './offers-section'

export function BuyerOfferGroups({
  offers,
  counterpart,
  initialDay,
  onDone,
}: {
  counterpart: 'vehículo' | 'comprador'
  offers: OfferRow[]
  initialDay?: string
  onDone: () => void
}) {
  const [today, setToday] = useState(initialDay ?? '')
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function tick() {
      setToday(offerDay(new Date()))
    }
    tick()
    const timer = window.setInterval(tick, 60000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', tick)
    }
  }, [])
  useEffect(() => {
    function reveal(hash: string) {
      if (!hash.startsWith('#oferta-')) return
      const target = document.getElementById(hash.slice(1))
      if (!target || !root.current?.contains(target)) return
      const history = target.closest('details[data-offer-history]')
      if (history instanceof HTMLDetailsElement) history.open = true
      if (target instanceof HTMLDetailsElement) target.open = true
      target.scrollIntoView({ block: 'nearest' })
    }
    function fromHash() {
      reveal(window.location.hash)
    }
    function fromLink(event: MouseEvent) {
      const href =
        event.target instanceof Element ? event.target.closest('a')?.getAttribute('href') : null
      if (href === window.location.hash && href) reveal(href)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    document.addEventListener('click', fromLink)
    return () => {
      window.removeEventListener('hashchange', fromHash)
      document.removeEventListener('click', fromLink)
    }
  }, [offers])

  const { reservations, open, history } = groupBuyerOffers(offers)
  function operation(offer: OfferRow) {
    const status =
      offer.status === 'ACEPTADA' ? 'Aceptada sin señal' : OFFER_STATUS_LABELS[offer.status]
    return (
      <details
        key={offer.id}
        id={`oferta-${offer.id}`}
        className="scroll-mt-20 border-t border-border py-2"
      >
        <summary className="cursor-pointer text-sm marker:text-muted-foreground">
          <span className="inline-flex w-[calc(100%-1.5rem)] flex-wrap items-baseline justify-between gap-x-3 align-middle">
            <strong className="min-w-0 break-words font-semibold">{offer.counterpartLabel}</strong>
            <b className="whitespace-nowrap font-semibold tabular-nums">
              {formatEur(offer.amount, 'cents')}
            </b>
          </span>
          <span className="block pl-4 text-xs text-muted-foreground">
            {status}
            {offer.createdAt && (
              <>
                {' '}
                · Oferta del{' '}
                <time dateTime={offer.createdAt}>{offerDateLabel(offer.createdAt)}</time>
              </>
            )}
          </span>
        </summary>
        <div className="space-y-1.5 pt-2 text-sm">
          {offer.depositAmount != null && (
            <p>Señal registrada · {formatEur(offer.depositAmount, 'cents')}</p>
          )}
          {offer.reservedUntil && (
            <p>
              Fecha límite registrada ·{' '}
              <time dateTime={offer.reservedUntil}>{offerDateLabel(offer.reservedUntil)}</time>
            </p>
          )}
          {offer.notes && <p className="whitespace-pre-line break-words">{offer.notes}</p>}
          <Link href={offer.counterpartHref} className="text-brand underline">
            Ver {counterpart}
          </Link>
          <OfferActions offer={offer} onDone={onDone} />
        </div>
      </details>
    )
  }
  return (
    <div ref={root} className="space-y-5">
      <section aria-label="Reservas">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <CalendarCheck aria-hidden className="h-4 w-4" />
          Reservas <span className="text-muted-foreground">{reservations.length}</span>
        </h3>
        {reservations.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin reservas con señal.</p>
        )}
        <div className="space-y-2">
          {reservations.map((o) => {
            const notice =
              o.reservedUntil && today ? reservationNotice(o.reservedUntil, today) : null
            return (
              <article
                key={o.id}
                id={`oferta-${o.id}`}
                className="scroll-mt-20 space-y-3 rounded-lg border border-l-4 border-border border-l-sidebar-primary bg-sidebar-primary/5 p-3"
              >
                <Link
                  href={o.counterpartHref}
                  className="break-words font-semibold hover:underline"
                >
                  {o.counterpartLabel}
                </Link>
                <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Precio acordado</dt>
                    <dd className="font-semibold tabular-nums">{formatEur(o.amount, 'cents')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Señal</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatEur(o.depositAmount!, 'cents')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Reservado hasta</dt>
                    <dd className="font-semibold">
                      {o.reservedUntil ? (
                        <time dateTime={o.reservedUntil}>{offerDateLabel(o.reservedUntil)}</time>
                      ) : (
                        'Sin fecha acordada'
                      )}
                    </dd>
                    {notice && (
                      <dd className="mt-1 w-fit rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                        {notice}
                      </dd>
                    )}
                  </div>
                </dl>
                <details>
                  <summary className="cursor-pointer text-xs font-medium">
                    Detalles de la reserva
                  </summary>
                  {o.createdAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Oferta del {offerDateLabel(o.createdAt)}
                    </p>
                  )}
                  {o.notes && (
                    <p className="mt-2 whitespace-pre-line break-words text-sm">{o.notes}</p>
                  )}
                  <OfferActions offer={o} onDone={onDone} />
                </details>
              </article>
            )
          })}
        </div>
      </section>
      <section aria-label="Ofertas abiertas">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <FileText aria-hidden className="h-4 w-4" />
          Ofertas abiertas <span className="text-muted-foreground">{open.length}</span>
        </h3>
        {open.length ? (
          open.map(operation)
        ) : (
          <p className="text-sm text-muted-foreground">Sin ofertas abiertas.</p>
        )}
      </section>
      {history.length > 0 && (
        <details data-offer-history className="border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Historial de operaciones{' '}
            <span className="ml-1 text-muted-foreground">{history.length}</span>
          </summary>
          <div className="mt-2">{history.map(operation)}</div>
        </details>
      )}
    </div>
  )
}
