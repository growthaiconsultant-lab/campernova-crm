import type { VehicleMarginOutput } from '@/lib/margin'

interface Props {
  margin: VehicleMarginOutput
}

function fmt(n: number | null) {
  if (n === null) return '—'
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function fmtPct(n: number | null) {
  if (n === null) return '—'
  return `${n.toFixed(1)}%`
}

const CATEGORY_LABELS: Record<string, string> = {
  PIEZAS: 'Piezas',
  MANO_OBRA_TALLER: 'Mano obra',
  INSTALACION: 'Instalación',
  LIMPIEZA: 'Limpieza',
  MARKETING: 'Marketing',
  CUSTODIA: 'Custodia',
  POSTVENTA: 'Postventa',
  OTRO: 'Otro',
}

export function VehicleMarginSummary({ margin }: Props) {
  const hasPrices = margin.purchasePrice !== null && margin.salePrice !== null

  return (
    <div className="rounded-xl border border-cn-line bg-cn-cream-50 p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-cn-ink-500">Precio compra</p>
          <p className="mt-0.5 text-lg font-semibold text-cn-teal-900">
            {fmt(margin.purchasePrice)}
          </p>
        </div>
        <div>
          <p className="text-xs text-cn-ink-500">Precio venta</p>
          <p className="mt-0.5 text-lg font-semibold text-cn-teal-900">{fmt(margin.salePrice)}</p>
        </div>
        <div>
          <p className="text-xs text-cn-ink-500">Margen bruto</p>
          <p className="mt-0.5 text-lg font-semibold text-cn-teal-900">
            {fmt(margin.grossMargin)}
            {margin.grossMargin !== null && margin.salePrice ? (
              <span className="ml-1 text-sm font-normal text-cn-ink-500">
                ({fmtPct((margin.grossMargin / margin.salePrice) * 100)})
              </span>
            ) : null}
          </p>
        </div>
        <div>
          <p className="text-xs text-cn-ink-500">Costes imputados</p>
          <p className="mt-0.5 text-lg font-semibold text-red-600">
            {margin.totalCosts > 0 ? `−${fmt(margin.totalCosts)}` : fmt(0)}
          </p>
        </div>
      </div>

      {/* Desglose por categoría */}
      {Object.keys(margin.costsByCategory).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(margin.costsByCategory).map(([cat, amount]) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 rounded-full bg-cn-line px-2.5 py-0.5 text-xs text-cn-ink-700"
            >
              {CATEGORY_LABELS[cat] ?? cat}
              <span className="font-medium">{fmt(amount ?? null)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Margen neto */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-cn-line bg-white px-4 py-3">
        <div>
          <p className="text-xs text-cn-ink-500">Margen neto</p>
          <p
            className={`text-2xl font-bold ${
              margin.netMargin === null
                ? 'text-cn-ink-400'
                : margin.netMargin < 0
                  ? 'text-red-600'
                  : 'text-cn-teal-900'
            }`}
          >
            {fmt(margin.netMargin)}
            {margin.marginPercentReal !== null && (
              <span className="ml-2 text-base font-normal">
                ({fmtPct(margin.marginPercentReal)})
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-cn-ink-500">Objetivo</p>
          <p className="text-sm font-medium text-cn-ink-700">
            {fmtPct(margin.marginPercentTarget)}
          </p>
        </div>
        {margin.isBelowTarget && (
          <span className="ml-3 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
            Bajo objetivo
          </span>
        )}
        {!hasPrices && (
          <span className="text-cn-ink-400 text-xs">Faltan precios de compra y venta</span>
        )}
      </div>
    </div>
  )
}
