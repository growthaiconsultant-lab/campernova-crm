import Link from 'next/link'
import { CheckCircle2, CircleHelp, CircleX } from 'lucide-react'
import { db } from '@/lib/db'
import { vehicleLabel } from '@/lib/display'
import { formatEur } from '@/lib/format/currency'
import { prismaMatchingDeps } from '@/lib/matching/prisma-deps'
import { scorePair, compareMatches } from '@/lib/matching/find'
import { assessPair } from '@/lib/matching/assessment'
import { createManualMatch } from '@/app/(backoffice)/matches/manual-actions'
import { AddBuyerInterestButton } from './add-buyer-interest-button'
import { BuyerStockFilter, type FitState } from './buyer-stock-filter'
import { StatusButtons } from './matches-section'

export async function BuyerCatalogResults({
  id,
  selectedVehicleIds,
  suggestions,
}: {
  id: string
  selectedVehicleIds: string[]
  suggestions: { vehicleId: string; id: string; status: string }[]
}) {
  const selected = new Set(selectedVehicleIds)
  const suggested = new Map(suggestions.map((m) => [m.vehicleId, m]))
  const deps = prismaMatchingDeps(db)
  const buyer = await deps.getBuyer(id)
  if (!buyer) return null
  const vehicles = await deps.listEligibleVehicles()
  const rows = vehicles
    .map((vehicle) => {
      const result = assessPair(vehicle, buyer)
      return { vehicle, result, rank: scorePair(vehicle, buyer, undefined, result) }
    })
    .sort(
      (a, b) =>
        b.result.confirmed.length - a.result.confirmed.length || compareMatches(a.rank, b.rank)
    )

  const hasCriteria = rows.some(
    ({ result: r }) => r.met.length || r.wanted.length || r.failed.length || r.missing.length
  )
  function group(state: FitState) {
    const items = rows.filter((row) => row.result.state === state)
    return {
      count: items.length,
      list: (
        <ul className="divide-y divide-border">
          {items.map(({ vehicle: v, result: r }) => {
            const suggestion = suggested.get(v.id)
            const preferenceMisses = r.wanted.filter(
              (x) => !r.confirmed.includes(x) && !r.unknown.includes(x)
            )
            const details = [
              ['Imprescindibles cubiertos', r.met],
              ['Imprescindibles pendientes', r.missing],
              ['Imprescindibles que incumple', r.failed],
              ['Preferencias cubiertas', r.confirmed],
              ['Preferencias pendientes', r.unknown],
              ['Preferencias que no cubre', preferenceMisses],
            ] as const
            const reason =
              state === 'descartado'
                ? v.price != null && buyer?.maxBudget != null && v.price > buyer.maxBudget
                  ? `Supera el presupuesto en ${formatEur(v.price - buyer.maxBudget)}.`
                  : `Incumple: ${r.failed[0]}.`
                : state === 'pendiente'
                  ? `Falta confirmar: ${r.missing[0]}.`
                  : [
                      r.met.length ? 'Cumple los imprescindibles' : '',
                      r.wanted.length
                        ? `${r.confirmed.length} de ${r.wanted.length} preferencias cubiertas`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')
            const Icon =
              state === 'apto' ? CheckCircle2 : state === 'pendiente' ? CircleHelp : CircleX
            return (
              <li key={v.id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link
                    className="font-semibold hover:text-sidebar-primary hover:underline"
                    href={'/vendedores/' + v.sellerLeadId}
                  >
                    {vehicleLabel(v, { withId: true })}
                  </Link>
                  <span className="text-sm font-semibold tabular-nums">
                    {v.price != null ? formatEur(v.price) : 'Precio por confirmar'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {v.seats ?? 'Sin dato'} para viajar · {v.sleepingPlaces ?? 'Sin dato'} para dormir
                </p>
                <p
                  className={`flex items-start gap-2 text-sm ${state === 'apto' ? 'text-sidebar-primary' : state === 'pendiente' ? 'text-amber-800' : 'text-red-800'}`}
                >
                  <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  {reason}
                </p>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <details className="min-w-0 grow text-sm">
                    <summary className="w-fit cursor-pointer py-2 font-medium underline underline-offset-4">
                      Ver criterios
                    </summary>
                    <dl className="space-y-2 rounded-lg bg-muted/50 p-3">
                      {details.map(
                        ([label, values]) =>
                          values.length > 0 && (
                            <div key={label}>
                              <dt className="font-medium">{label}</dt>
                              <dd className="text-muted-foreground">{values.join(' · ')}</dd>
                            </div>
                          )
                      )}
                    </dl>
                    {suggestion && (
                      <div className="mt-3">
                        <p className="mb-2 font-medium">Estado de la sugerencia</p>
                        <StatusButtons matchId={suggestion.id} currentStatus={suggestion.status} />
                      </div>
                    )}
                  </details>
                  {selected.has(v.id) ? (
                    <a
                      className="py-2 text-sm font-medium text-sidebar-primary underline"
                      href={`#interes-${v.id}`}
                    >
                      Ver seguimiento
                    </a>
                  ) : (
                    <AddBuyerInterestButton
                      selected={false}
                      save={createManualMatch.bind(null, { buyerLeadId: id, vehicleId: v.id })}
                    />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ),
    }
  }
  return (
    <section
      aria-label="Vehículos disponibles"
      className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <h2 className="text-lg font-semibold">Vehículos disponibles</h2>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay vehículos disponibles para comparar.
        </p>
      ) : !hasCriteria ? (
        <p className="text-sm text-muted-foreground">
          <Link className="underline" href={`/compradores/${id}?tab=busqueda`}>
            Añade criterios en Qué busca
          </Link>{' '}
          para comparar el stock.
        </p>
      ) : (
        <BuyerStockFilter
          groups={{
            apto: group('apto'),
            pendiente: group('pendiente'),
            descartado: group('descartado'),
          }}
        />
      )}
    </section>
  )
}
