import { CircleHelp, ListChecks, Pencil, Star } from 'lucide-react'
import { buyerSearchCriteria, type BuyerCriteriaInput } from '@/lib/buyer-criteria'
import type { Catalog } from '@/lib/matching/catalog'

function CriteriaGroup({
  title,
  items,
  icon,
  empty,
}: {
  title: string
  items: string[]
  icon: React.ReactNode
  empty: string
}) {
  const rows = items.map((item) => (
    <li key={item} className="break-words [overflow-wrap:anywhere]">
      {item}
    </li>
  ))
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </h3>
      {items.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm marker:text-brand">
          {rows.slice(0, 4)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
      {items.length > 4 && (
        <details className="mt-2">
          <summary className="cursor-pointer py-1 text-sm font-medium text-brand">
            Ver {items.length - 4} más
          </summary>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{rows.slice(4)}</ul>
        </details>
      )}
    </section>
  )
}

const places = (n: number | null) =>
  n == null ? 'Por confirmar' : n === 1 ? '1 plaza mín.' : `${n} plazas mín.`

export function BuyerSearchBrief({
  buyer,
  catalog,
  editOpen,
  usage,
  usageEditor,
  equipmentEditor,
  children,
}: {
  buyer: BuyerCriteriaInput
  catalog: Catalog
  usage: string
  usageEditor: React.ReactNode
  equipmentEditor: React.ReactNode
  editOpen: boolean
  children: React.ReactNode
}) {
  const { family, required, preferred } = buyerSearchCriteria(buyer, catalog)
  const missing = [
    !family && 'Tipo de vehículo',
    buyer.maxBudget == null && 'Presupuesto máximo',
    buyer.minSeats == null && 'Plazas para viajar',
    buyer.sleepingPlacesRequired == null && 'Plazas para dormir',
  ].filter(Boolean)
  const dimensionQuestion =
    buyer.maxLengthM != null && buyer.maxHeightM == null
      ? '¿Hay también un límite de altura para aparcar?'
      : undefined
  const facts = [
    [
      'Presupuesto máximo',
      buyer.maxBudget == null
        ? 'Por confirmar'
        : Number(buyer.maxBudget).toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0,
          }),
    ],
    ['Para viajar', places(buyer.minSeats)],
    ['Para dormir', places(buyer.sleepingPlacesRequired)],
  ]
  return (
    <>
      <section
        aria-label="Vehículo buscado"
        className="relative rounded-xl bg-[#193f31] p-4 text-white sm:p-5"
      >
        <p className="pr-36 text-sm text-white/80">Vehículo buscado</p>
        <h2 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:pr-36">
          {family || 'Tipo por confirmar'}
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/25 pt-3 sm:grid-cols-3">
          {facts.map(([label, value], i) => (
            <div key={label} className={i === 0 ? 'col-span-2 sm:col-span-1' : undefined}>
              <dt className="text-xs text-white/80">{label}</dt>
              <dd className="mt-1 text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 break-words border-t border-white/25 pt-3 text-sm [overflow-wrap:anywhere]">
          <span className="text-white/80">Uso principal</span>
          <span className="ml-2 font-semibold">{usage}</span>
        </p>
        <details id="editar" open={editOpen || undefined} className="scroll-mt-20">
          <summary className="absolute right-3 top-2 inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-white/40 px-2 text-xs font-medium hover:bg-white/10 sm:right-5 sm:top-3 [&::-webkit-details-marker]:hidden">
            <Pencil size={14} aria-hidden="true" />
            Editar búsqueda
          </summary>
          <div className="mt-4 min-w-0 rounded-xl bg-background p-2 text-foreground sm:p-4">
            {children}
          </div>
        </details>
      </section>
      {usageEditor}
      <section aria-label="Equipamiento y requisitos" className="space-y-3">
        <h2 className="text-lg font-semibold">¿Qué necesita el vehículo?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <CriteriaGroup
            title="Imprescindible"
            items={required}
            icon={<ListChecks size={18} className="text-brand" aria-hidden="true" />}
            empty="Sin otros requisitos registrados."
          />
          <CriteriaGroup
            title="Preferiría"
            items={preferred}
            icon={<Star size={17} className="text-brand" aria-hidden="true" />}
            empty="Sin preferencias registradas."
          />
        </div>
        {equipmentEditor}
      </section>
      {(missing.length > 0 || dimensionQuestion) && (
        <aside
          aria-label="Por confirmar"
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <CircleHelp size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Por confirmar</h3>
            {missing.length > 0 && <p>{missing.join(' · ')}</p>}
            {dimensionQuestion && <p>{dimensionQuestion}</p>}
          </div>
        </aside>
      )}
    </>
  )
}
