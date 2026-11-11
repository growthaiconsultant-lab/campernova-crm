import Link from 'next/link'
import type { Vehicle } from '@prisma/client'
import { formatEur } from '@/lib/format/currency'
import { offerDateLabel, offerDay, reservationNotice } from '@/lib/buyer-offers'
import { OFFER_STATUS_LABELS } from '@/lib/offers'
import { vehicleSlug } from '@/lib/public-catalog'
import type { sellerSale } from '@/lib/seller-sale'
import { salePortals, type SalePortal } from '@/lib/portal-listings'
import { SellerPortalListing } from './seller-portal-listing'

type ChannelProps = {
  vehicle: Pick<Vehicle, 'id' | 'brand' | 'model' | 'year' | 'status' | 'publishedAt'>
  sellerId: string
  editable: boolean
  listings: {
    channel: SalePortal
    url: string
    publishedOn: Date
    withdrawnAt: Date | null
    revision: number
  }[]
  ads: { channel: SalePortal }[]
  renderTextTool?: (channel: SalePortal) => React.ReactNode
  webAction?: React.ReactNode
  children?: React.ReactNode
  showToolsLink: boolean
}
export function SellerSaleChannels({
  vehicle,
  sellerId,
  editable,
  listings,
  ads,
  showToolsLink,
  renderTextTool,
  webAction,
  children,
}: ChannelProps) {
  const channels = salePortals.map((channel) => {
    const saved = listings.find((row) => row.channel === channel)
    return {
      channel,
      draft: ads.some((ad) => ad.channel === channel),
      listing: saved
        ? {
            url: saved.url,
            publishedOn: saved.publishedOn.toISOString().slice(0, 10),
            withdrawn: !!saved.withdrawnAt,
            revision: saved.revision,
          }
        : null,
    }
  })
  const publishedCount =
    Number(vehicle.status === 'PUBLICADO') +
    channels.filter(({ listing }) => listing && !listing.withdrawn).length
  return (
    <section aria-labelledby="sale-channels" className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="sale-channels" className="mb-2 text-lg font-semibold">
          {showToolsLink ? 'Dónde está anunciado' : 'Publicación y anuncios'}
        </h2>
        {!showToolsLink && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Publicado en {publishedCount} de {1 + channels.length}
          </p>
        )}
      </div>
      <div className="divide-y">
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong>Web CampersNova</strong>
              {!showToolsLink && vehicle.status === 'PUBLICADO' && (
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">
                  Publicado
                </span>
              )}
            </div>
            <p className="text-sm">
              {vehicle.status === 'PUBLICADO'
                ? showToolsLink
                  ? 'Publicado'
                  : 'En el catálogo web'
                : 'Fuera del catálogo público'}
              {vehicle.status === 'PUBLICADO' &&
                vehicle.publishedAt &&
                ' · Primera publicación el ' + offerDateLabel(vehicle.publishedAt.toISOString())}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {vehicle.status === 'PUBLICADO' && (
              <Link
                className="text-sm text-brand underline"
                href={'/comprar/' + vehicleSlug(vehicle)}
              >
                Ver anuncio
              </Link>
            )}
            {webAction}
          </div>
        </div>
        {channels.map(({ channel, listing, draft }) => (
          <SellerPortalListing
            key={channel + ':' + (listing?.revision ?? 0)}
            sellerId={sellerId}
            vehicleId={vehicle.id}
            channel={channel}
            listing={listing}
            draft={draft}
            editable={editable}
          >
            {renderTextTool?.(channel)}
          </SellerPortalListing>
        ))}
      </div>
      {children}
      {showToolsLink && (
        <Link
          className="inline-flex py-2 text-sm text-brand underline"
          href={'/vendedores/' + sellerId + '?tab=publicacion'}
        >
          Preparar textos y fotos →
        </Link>
      )}
    </section>
  )
}

export function SellerSaleOverview({
  sale,
  price,
  children,
}: {
  sale: ReturnType<typeof sellerSale>
  price: number | null
  children: React.ReactNode
}) {
  const { reservation, offer, interested } = sale
  const operation = reservation ?? offer
  const delta =
    operation && price != null ? Math.round((operation.amount - price) * 100) / 100 : null
  const deadline = reservation?.reservedUntil
  const notice = deadline ? reservationNotice(deadline, offerDay(new Date())) : null
  return (
    <>
      <section
        aria-labelledby="sale-operation"
        className="space-y-2 rounded-xl border border-l-4 border-l-sidebar-primary bg-sidebar-primary/5 p-4 sm:p-5"
      >
        <h2 id="sale-operation" className="font-semibold">
          {reservation
            ? 'Reserva con señal'
            : offer
              ? 'Oferta abierta'
              : 'Sin ofertas ni reservas abiertas'}
        </h2>
        {operation && (
          <>
            <p className="text-xl font-bold">
              {formatEur(operation.amount, 'cents')}{' '}
              <span className="text-sm font-medium">· {operation.counterpartLabel}</span>
            </p>
            {reservation ? (
              <p className="text-sm">
                Señal recibida · <strong>{formatEur(reservation.depositAmount!, 'cents')}</strong> ·{' '}
                {deadline ? 'Hasta el ' + offerDateLabel(deadline) : 'Sin fecha límite registrada'}{' '}
                {notice && (
                  <strong className="text-amber-800 dark:text-amber-300">· {notice}</strong>
                )}
              </p>
            ) : (
              <p className="text-sm">
                {operation.status === 'ACEPTADA'
                  ? 'Aceptada sin señal'
                  : OFFER_STATUS_LABELS[operation.status]}{' '}
                · {offerDateLabel(operation.createdAt)}
                {delta != null &&
                  (delta === 0
                    ? ' · Coincide con el precio de venta'
                    : ' · ' +
                      formatEur(Math.abs(delta), 'cents') +
                      (delta < 0 ? ' por debajo' : ' por encima') +
                      ' del precio de venta')}
              </p>
            )}
            <a
              className="inline-block py-1 text-sm font-semibold text-brand underline"
              href={'#oferta-' + operation.id}
            >
              Ver operación
            </a>
          </>
        )}
        {!operation && (
          <a
            className="inline-flex py-1 text-sm font-semibold text-brand underline"
            href="#venta-ofertas"
          >
            Ver ofertas e historial
          </a>
        )}
      </section>
      {children}

      <section aria-labelledby="sale-interest" className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 id="sale-interest" className="mb-2 text-lg font-semibold">
          Compradores con interés · {interested.length}
        </h2>
        {interested.length ? (
          <ul className="divide-y">
            {interested.map((buyer) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                key={buyer.buyerId}
              >
                <Link
                  href={'/compradores/' + buyer.buyerId}
                  className="font-semibold text-brand underline"
                >
                  {buyer.name}
                </Link>
                {buyer.offerId ? (
                  <a href={'#oferta-' + buyer.offerId} className="underline">
                    {buyer.signal}
                  </a>
                ) : (
                  <span>{buyer.signal}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin visitas ni ofertas activas registradas para este vehículo.
          </p>
        )}
      </section>
    </>
  )
}
