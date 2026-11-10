import Link from 'next/link'
import { ChevronDown, CalendarClock, ShieldCheck, History } from 'lucide-react'
import { CompletedSaleCard } from '@/components/completed-sale-card'
import type { CompletedSale } from '@/lib/completed-sales'
import { vehicleLabel } from '@/lib/display'
import {
  followupTitle,
  postventaDate,
  postventaHistory,
  type BuyerWarranty,
} from '@/lib/buyer-postventa'
import { isTerminalTicketStatus } from '@/lib/postventa/transitions'
import { offerDay } from '@/lib/buyer-offers'

const priority = { CRITICA: 'crítica', ALTA: 'alta', MEDIA: 'media', BAJA: 'baja' }
const muted = 'text-sm text-muted-foreground'
const heading = 'text-base font-semibold'
const detailsTitle = 'flex min-h-11 cursor-pointer items-center justify-between gap-3 py-2'
const arrow = (
  <ChevronDown
    aria-hidden
    className="h-4 w-4 shrink-0 text-muted-foreground group-open:rotate-180"
  />
)

export function BuyerPostventa({
  warranty,
  sales,
  now = new Date(),
}: {
  warranty: BuyerWarranty | null
  sales: CompletedSale[]
  now?: Date
}) {
  if (!warranty)
    return (
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className={heading}>Postventa</h2>
        <p>
          {sales.length
            ? 'Entrega completada · Sin garantía registrada'
            : 'Todavía no consta una entrega con garantía.'}
        </p>
        <CompletedSaleCard side="buyer" sales={sales} />
      </section>
    )

  const today = offerDay(now)
  const overdue = (date: Date | null) => date !== null && offerDay(date) < today
  const tickets = warranty.tickets
    .filter((t) => !isTerminalTicketStatus(t.status))
    .sort((a, b) => Number(overdue(b.dueAt)) - Number(overdue(a.dueAt)))
  const failed = warranty.followups.filter((f) => f.status === 'FALLIDO')
  const scheduled = warranty.followups.filter((f) => f.status === 'PENDIENTE')
  const pending = tickets.length + failed.length
  const end = warranty.extendedTo ?? warranty.endDate
  const expired = end < now
  const history = postventaHistory(warranty)

  return (
    <section
      data-sentry-mask
      className="ph-no-capture ph-mask mx-auto max-w-4xl overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="border-b border-border bg-sidebar-primary/5 px-4 py-4 sm:px-6">
        <h2 className="text-xl font-semibold">Postventa</h2>
        <p className="mt-1 text-sm">
          {vehicleLabel(warranty.vehicle, { withId: true })}
          {warranty.delivery.completedAt && (
            <> · Entrega del {postventaDate(warranty.delivery.completedAt)}</>
          )}
        </p>
      </header>
      <div className="space-y-5 p-4 sm:p-6">
        <section aria-labelledby="pv-attention" className="space-y-2">
          <h3 id="pv-attention" className={heading}>
            {pending ? `Requiere atención (${pending})` : 'Todo al día'}
          </h3>
          {!pending && <p className={muted}>Sin incidencias pendientes ni envíos fallidos.</p>}
          {tickets.map((t) => {
            const late = overdue(t.dueAt)
            const state =
              t.status === 'RESUELTO'
                ? 'Pendiente de cierre'
                : t.status === 'EN_PROGRESO'
                  ? 'En curso'
                  : 'Abierta'
            return (
              <details
                key={t.id}
                className={`group rounded-lg border px-3 ${late ? 'border-l-4 border-l-amber-600' : 'border-border'}`}
              >
                <summary className={detailsTitle}>
                  <span className="grid min-w-0 gap-1 break-words">
                    <span
                      className={
                        late ? 'text-xs font-semibold text-amber-800 dark:text-amber-300' : muted
                      }
                    >
                      {state}
                      {t.dueAt && (
                        <>
                          {' '}
                          ·{' '}
                          {late
                            ? 'Plazo vencido'
                            : offerDay(t.dueAt) === today
                              ? 'Vence hoy'
                              : 'Vence'}{' '}
                          · {postventaDate(t.dueAt)}
                        </>
                      )}
                    </span>
                    <strong>{t.title}</strong>
                    <span className={muted}>
                      Prioridad {priority[t.priority]} · {t.responsible?.name ?? 'Sin responsable'}
                    </span>
                  </span>
                  {arrow}
                </summary>
                <div className="space-y-2 whitespace-pre-wrap break-words border-t py-3 text-sm">
                  <p>{t.description}</p>
                  {t.resolvedAt && <p>Resuelta el {postventaDate(t.resolvedAt)}</p>}
                  {t.solution && <p>Solución registrada · {t.solution}</p>}
                </div>
              </details>
            )
          })}
          {failed.map((f) => (
            <div key={f.id} className="rounded-lg border border-l-4 border-l-amber-600 p-3">
              <strong>{followupTitle(f.type)} · Envío fallido</strong>
              <p className={muted}>
                Programado para el {postventaDate(f.scheduledFor)} · Revisar en Postventa
              </p>
            </div>
          ))}
        </section>
        <section aria-labelledby="pv-next" className="space-y-2">
          <h3 id="pv-next" className={heading}>
            Próximo seguimiento
          </h3>
          {scheduled.length ? (
            scheduled.map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <CalendarClock aria-hidden className="h-5 w-5 shrink-0 text-sidebar-primary" />
                <div>
                  <strong className="text-sm">{followupTitle(f.type)}</strong>
                  <p className={muted}>
                    {postventaDate(f.scheduledFor)} ·{' '}
                    {overdue(f.scheduledFor)
                      ? 'Pendiente de envío automático'
                      : 'Envío automático programado'}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className={muted}>Sin correos programados.</p>
          )}
        </section>
        <div className="divide-y border-y border-border">
          <details className="group">
            <summary className={detailsTitle}>
              <ShieldCheck aria-hidden className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                <strong>Entrega y garantía</strong>
                <span className={'block ' + muted}>
                  {expired ? 'Garantía vencida el' : 'Garantía activa hasta el'}{' '}
                  {postventaDate(end)}
                </span>
              </span>
              {arrow}
            </summary>
            <div className="space-y-3 pb-3">
              <p className={muted}>
                Inicio · {postventaDate(warranty.startDate)}
                {warranty.extendedTo && <> · Ampliada hasta el {postventaDate(end)}</>}
              </p>
              <CompletedSaleCard side="buyer" sales={sales} />
            </div>
          </details>
          <details className="group">
            <summary className={detailsTitle}>
              <History aria-hidden className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                <strong>Historial de postventa</strong>
                {history[0]?.date && (
                  <span className={'block ' + muted}>
                    Último registro · {postventaDate(history[0].date)}
                  </span>
                )}
              </span>
              {arrow}
            </summary>
            {history.length ? (
              <ul className="divide-y">
                {history.map((e) => (
                  <li key={e.id} className="space-y-1 break-words py-3 text-sm">
                    <strong>{e.title}</strong>
                    <p className={muted}>
                      {e.date ? postventaDate(e.date) : 'Fecha sin registrar'}
                    </p>
                    {e.note && <p className="whitespace-pre-wrap">{e.note}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={'pb-3 ' + muted}>
                Todavía no hay incidencias finalizadas ni correos enviados.
              </p>
            )}
          </details>
        </div>
        <Link
          href={`/postventa/${warranty.id}`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-sidebar-primary hover:underline"
        >
          Abrir expediente de postventa →
        </Link>
      </div>
    </section>
  )
}
