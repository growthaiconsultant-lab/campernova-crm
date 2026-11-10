import Link from 'next/link'
import type { MatchStatus, OfferStatus } from '@prisma/client'
import { StatusButtons } from './matches-section'
import { ManualAssociationsCard } from './manual-associations-card'
import { OFFER_STATUS_LABELS, isReservation } from '@/lib/offers'
import { formatEur } from '@/lib/format/currency'
import type { FitState } from './buyer-stock-filter'

const statuses: Record<MatchStatus, string> = {
  SUGERIDO: 'Sugerido',
  PROPUESTO_CLIENTE: 'Propuesto al comprador',
  VISITA: 'Visita',
  OFERTA: 'Oferta',
  CERRADO: 'Cerrado',
  RECHAZADO: 'Rechazado',
}
const fitLabels = { apto: 'Encaja', pendiente: 'Falta comprobar', descartado: 'Fuera de criterios' }
export type TrackedOffer = {
  id: string
  status: OfferStatus
  amount: number
  depositAmount: number | null
}
export type TrackedVehicle = {
  vehicleId: string
  label: string
  href: string
  plate?: string | null
  km?: number | null
  price?: number | null
  photoUrl?: string | null
  fit?: FitState | null
  outsideStock?: boolean
  match?: { id: string; status: MatchStatus; manual: boolean; editable: boolean }
  offers: TrackedOffer[]
}

export function BuyerTrackedVehicles({
  id,
  vehicles,
  eligible,
}: {
  id: string
  vehicles: TrackedVehicle[]
  eligible: boolean
}) {
  return (
    <section
      id="sugerencias"
      aria-label="En seguimiento con este comprador"
      className="scroll-mt-20 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          En seguimiento con este comprador{' '}
          <span className="ml-1 text-sm text-muted-foreground">{vehicles.length}</span>
        </h2>
        <ManualAssociationsCard
          side="buyer"
          actionOnly
          fixedId={id}
          listHref="#sugerencias"
          entries={[]}
          disabledReason={
            eligible
              ? undefined
              : 'Esta ficha está cerrada, perdida o archivada. No admite nuevos intereses.'
          }
        />
      </div>
      {vehicles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay vehículos en seguimiento.</p>
      ) : (
        <ul className="divide-y divide-border">
          {vehicles.map((v) => (
            <li
              id={`interes-${v.vehicleId}`}
              key={v.vehicleId}
              className="scroll-mt-20 space-y-2 py-3"
            >
              <div className="flex items-center gap-3">
                {v.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.photoUrl}
                    alt=""
                    loading="lazy"
                    className="h-12 w-16 shrink-0 rounded-md object-cover"
                  />
                )}
                <div className="min-w-0">
                  <Link href={v.href} className="font-semibold hover:underline">
                    {v.label}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {[
                      v.plate,
                      v.km != null && `${v.km.toLocaleString('es-ES')} km`,
                      v.price != null && formatEur(v.price),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {[
                  v.match &&
                    (v.match.manual && v.match.status === 'SUGERIDO'
                      ? 'Añadido por el equipo'
                      : statuses[v.match.status]),
                  v.fit && fitLabels[v.fit],
                  v.outsideStock && 'Fuera del stock disponible',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {v.offers.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {v.offers.map((o) => (
                    <li key={o.id}>
                      <a
                        href={`#oferta-${o.id}`}
                        className="inline-block rounded-md bg-muted px-2 py-1 text-sm font-medium underline underline-offset-2"
                      >
                        {isReservation(o.status, o.depositAmount)
                          ? 'Reserva'
                          : 'Oferta · ' + OFFER_STATUS_LABELS[o.status]}{' '}
                        · {formatEur(o.amount, 'cents')}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {v.match?.editable && (
                <details>
                  <summary className="w-fit cursor-pointer py-1 text-sm underline underline-offset-4">
                    Cambiar estado
                  </summary>
                  <StatusButtons matchId={v.match.id} currentStatus={v.match.status} />
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
