import Link from 'next/link'
import type { NextActionType, OfferStatus, VehicleStatus } from '@prisma/client'
import { SellerFollowupForm } from './seller-followup-form'
import { NextActionEditor } from './next-action-editor'
import { NEXT_ACTION_LABELS } from '@/lib/next-action'
import { groupBuyerOffers, offerDateLabel } from '@/lib/buyer-offers'
import { saveSellerFollowup } from '@/app/(backoffice)/vendedores/[id]/followup-action'

type Step = { id: string | null; title: string; due: Date | null; owner: string | null }
type Props = {
  id: string
  archived: boolean
  agent: string | null
  actor: string
  reminderType: NextActionType | null
  reminderDue: Date | null
  events: { id: string; title: string; startAt: Date; assignedTo: { name: string } | null }[]
  vehicle: { status: VehicleStatus; salePrice: number | null; publishedAt: Date | null } | null
  offers: {
    id: string
    status: OfferStatus
    amount: number
    depositAmount: number | null
    reservedUntil: string | null
    createdAt: string
  }[]
}
const money = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})
const when = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  dateStyle: 'medium',
  timeStyle: 'short',
})
export function SellerFollowupPanel({
  id,
  archived,
  agent,
  actor,
  reminderType,
  reminderDue,
  events,
  vehicle,
  offers,
}: Props) {
  const steps: Step[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    due: e.startAt,
    owner: e.assignedTo?.name ?? null,
  }))
  if (reminderType)
    steps.push({
      id: null,
      title: NEXT_ACTION_LABELS[reminderType],
      due: reminderDue,
      owner: agent,
    })
  steps.sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity))
  const [first, ...others] = steps
  const groups = groupBuyerOffers(offers),
    reservation = groups.reservations[0],
    offer = groups.open[0]
  const path = '/vendedores/' + id
  function stepInfo(step: Step) {
    return (
      <div className="min-w-0 space-y-1">
        <p className="break-words text-base font-semibold">
          {step.id ? (
            <Link className="hover:underline" href={'/calendario/' + step.id}>
              {step.title}
            </Link>
          ) : (
            step.title
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {step.due ? (
            <>
              {step.due.getTime() < Date.now() && (
                <strong className="text-amber-800 dark:text-amber-300">Vencida · </strong>
              )}
              {when.format(step.due)} · Madrid
            </>
          ) : (
            'Sin fecha'
          )}{' '}
          · {step.owner ?? 'Sin responsable'}
        </p>
        {!step.id && (
          <NextActionEditor
            leadType="seller"
            leadId={id}
            nextActionType={reminderType}
            nextActionDueAt={reminderDue?.toISOString() ?? null}
            fallbackText=""
            editLabel="Editar recordatorio"
          />
        )}
      </div>
    )
  }
  return (
    <>
      <section
        aria-labelledby="seller-next"
        className="rounded-xl border border-l-4 border-l-sidebar-primary bg-sidebar-primary/5 p-4 sm:p-5"
      >
        <h2 id="seller-next" className="mb-1 text-sm font-semibold text-sidebar-primary">
          Próxima acción
        </h2>
        {first ? stepInfo(first) : <p className="font-semibold">Sin próxima acción programada</p>}
        <SellerFollowupForm
          save={saveSellerFollowup.bind(null, id)}
          archived={archived}
          assignee={agent ?? actor}
          callReminder={
            reminderType === 'LLAMAR' ? { dueAt: reminderDue?.toISOString() ?? null } : null
          }
        />
        {others.length > 0 && (
          <details className="mt-4 border-t pt-2">
            <summary className="cursor-pointer py-1 text-sm font-medium">
              Otras acciones pendientes ({others.length})
            </summary>
            <ul className="divide-y">
              {others.map((s) => (
                <li key={s.id ?? 'recordatorio'} className="py-2">
                  {stepInfo(s)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <section
        className="space-y-3 rounded-xl border bg-card p-4 sm:p-5"
        aria-labelledby="seller-progress"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="seller-progress" className="font-semibold">
            Cómo va la venta
          </h2>
          {vehicle && (
            <Link
              className="text-sm font-medium text-sidebar-primary underline"
              href={path + '?tab=compradores'}
            >
              Ver venta →
            </Link>
          )}
        </div>
        {!vehicle ? (
          <p>Sin vehículo vinculado.</p>
        ) : (
          <div className="divide-y text-sm">
            {reservation && (
              <div className="pb-2">
                <strong>Reserva con señal · {money.format(reservation.amount)}</strong>
                <p>
                  Señal de {money.format(reservation.depositAmount ?? 0)} ·{' '}
                  {reservation.reservedUntil
                    ? 'Hasta el ' + offerDateLabel(reservation.reservedUntil)
                    : 'Sin fecha límite registrada'}
                </p>
              </div>
            )}
            {offer && (
              <div className="py-2">
                <strong>
                  {groups.open.length === 1
                    ? 'Oferta abierta'
                    : groups.open.length + ' ofertas abiertas · Última oferta'}{' '}
                  · {money.format(offer.amount)}
                </strong>
                <p>
                  Registrada el {offerDateLabel(offer.createdAt)}
                  {vehicle.salePrice != null && (
                    <>
                      {' '}
                      ·{' '}
                      {offer.amount === vehicle.salePrice
                        ? 'Coincide con el precio de venta'
                        : money.format(Math.abs(vehicle.salePrice - offer.amount)) +
                          (offer.amount < vehicle.salePrice ? ' por debajo' : ' por encima') +
                          ' del precio de venta'}
                    </>
                  )}
                </p>
              </div>
            )}
            {!reservation && !offer && (
              <p className="pb-2 text-muted-foreground">Sin ofertas ni reservas abiertas.</p>
            )}
            <p className="pt-2">
              {vehicle.status === 'PUBLICADO'
                ? 'Anuncio publicado'
                : vehicle.status === 'VENDIDO'
                  ? 'Vehículo vendido'
                  : vehicle.status === 'RESERVADO'
                    ? 'Vehículo reservado'
                    : vehicle.status === 'DESCARTADO'
                      ? 'Vehículo descartado'
                      : 'Vehículo sin publicar'}
              {vehicle.status === 'PUBLICADO' &&
                vehicle.publishedAt &&
                ' · Desde el ' + offerDateLabel(vehicle.publishedAt.toISOString())}
            </p>
          </div>
        )}
      </section>
    </>
  )
}
