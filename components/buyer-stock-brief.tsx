import Link from 'next/link'
import { buyerSearchCriteria, type BuyerCriteriaInput } from '@/lib/buyer-criteria'
import type { Catalog } from '@/lib/matching/catalog'
import { formatEur } from '@/lib/format/currency'

export function BuyerStockBrief({
  buyer,
  catalog,
  usage,
  href,
}: {
  buyer: BuyerCriteriaInput
  catalog: Catalog
  usage: string
  href: string
}) {
  const { family, required, preferred } = buyerSearchCriteria(buyer, catalog)
  const preferences = buyer.useZone ? [...preferred, `Zona · ${buyer.useZone}`] : preferred
  return (
    <section className="space-y-3 rounded-xl border border-sidebar-primary/25 bg-sidebar-primary/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-sidebar-primary">Qué busca</h2>
        <Link href={href} className="text-xs font-semibold underline underline-offset-4">
          Ver búsqueda
        </Link>
      </div>
      <p className="text-lg font-semibold">
        {family ?? 'Tipo de vehículo por confirmar'}
        {usage !== 'Por confirmar' && <span className="font-normal"> · {usage}</span>}
      </p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Presupuesto máximo</dt>
          <dd className="font-semibold">
            {buyer.maxBudget != null ? formatEur(Number(buyer.maxBudget)) : 'Por confirmar'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Plazas mínimas</dt>
          <dd className="font-semibold">
            {buyer.minSeats ?? 'Sin dato'} para viajar ·{' '}
            {buyer.sleepingPlacesRequired ?? 'Sin dato'} para dormir
          </dd>
        </div>
      </dl>
      <dl className="space-y-1 border-t border-sidebar-primary/15 pt-3 text-sm">
        {(
          [
            ['Imprescindible', required],
            ['Preferiría', preferences],
          ] as const
        ).map(([label, values]) => (
          <div key={label} className="flex flex-wrap gap-x-2">
            <dt className="font-medium">{label}</dt>
            <dd className="text-muted-foreground">
              {values.length ? values.join(' · ') : 'Sin especificar'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
