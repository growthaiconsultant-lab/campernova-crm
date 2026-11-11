import Link from 'next/link'
import type { OfferStatus } from '@prisma/client'
import { groupBuyerOffers } from '@/lib/buyer-offers'
import { formatEur } from '@/lib/format/currency'

type PriceOffer = {
  id: string
  status: OfferStatus
  amount: number
  depositAmount: number | null
  reservedUntil: string | null
  counterpartLabel: string
}

export function SellerPriceComparison({
  sellerId,
  offers,
  minimum,
  salePrice,
  published,
  archived,
}: {
  sellerId: string
  offers: PriceOffer[]
  minimum: number | null
  salePrice: number | null
  published: boolean
  archived: boolean
}) {
  const { reservations, open } = groupBuyerOffers(offers)
  const reserved = reservations[0]
  const offer = reserved ?? open[0]
  const difference =
    offer && minimum != null
      ? (Math.round(offer.amount * 100) - Math.round(minimum * 100)) / 100
      : null
  const label = reserved
    ? 'Reserva con señal'
    : offer?.status === 'ACEPTADA'
      ? 'Oferta aceptada sin señal'
      : offer?.status === 'CONTRAOFERTA'
        ? 'Contraoferta abierta'
        : 'Oferta abierta'
  const subject = reserved
    ? 'La reserva'
    : offer?.status === 'CONTRAOFERTA'
      ? 'La contraoferta'
      : 'La oferta'
  const comparison =
    difference == null
      ? null
      : difference === 0
        ? `${subject} coincide con el mínimo del vendedor`
        : `${subject} está ${formatEur(Math.abs(difference), 'cents')} por ${difference < 0 ? 'debajo' : 'encima'} del mínimo del vendedor`
  const consult = difference != null && difference < 0 && offer?.status !== 'ACEPTADA' && !archived
  const values = [
    [label, offer ? formatEur(offer.amount, 'cents') : 'Sin oferta abierta'],
    ['Mínimo del vendedor', minimum == null ? 'Sin indicar' : formatEur(minimum, 'cents')],
    [
      published ? 'Precio anunciado' : 'Precio de venta',
      salePrice == null ? 'Sin indicar' : formatEur(salePrice, 'cents'),
    ],
  ]
  return (
    <section
      aria-labelledby="comparacion-precios"
      className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
    >
      <h2 id="comparacion-precios" className="text-lg font-semibold">
        Tasación y economía
      </h2>
      {offer && (
        <div
          className={
            difference != null && difference < 0
              ? 'rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950 dark:text-amber-100'
              : 'rounded-md bg-muted p-3'
          }
        >
          <p className="font-semibold">
            {comparison ?? 'Falta indicar el mínimo del vendedor para comparar'}
          </p>
          <p className="text-sm">
            {label} · {offer.counterpartLabel}
          </p>
          {consult && (
            <p className="mt-1 text-sm">
              Consulta con el vendedor antes de responder al comprador.
            </p>
          )}
        </div>
      )}
      <dl className="grid gap-3 sm:grid-cols-3">
        {values.map(([name, value]) => (
          <div key={name}>
            <dt className="text-sm text-muted-foreground">{name}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {consult && offer && minimum != null && (
        <details className="border-t pt-3 text-sm">
          <summary className="cursor-pointer font-medium text-brand">
            Preparar consulta al vendedor
          </summary>
          <p className="mt-2 rounded-md bg-muted p-3">
            «Tenemos {offer.status === 'CONTRAOFERTA' ? 'una contraoferta' : 'una oferta'} de{' '}
            {formatEur(offer.amount, 'cents')} por el vehículo. Nos indicaste un mínimo de{' '}
            {formatEur(minimum, 'cents')}. ¿Quieres mantener ese precio o valorar esta cifra?»
          </p>
        </details>
      )}
      {offer && (
        <Link
          className="inline-block text-sm text-brand underline"
          href={`/vendedores/${sellerId}?tab=compradores#oferta-${offer.id}`}
        >
          Ver {reserved ? 'reserva' : 'oferta'} en Venta
        </Link>
      )}
    </section>
  )
}
