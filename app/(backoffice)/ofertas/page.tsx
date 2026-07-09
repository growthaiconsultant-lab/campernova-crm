import Link from 'next/link'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { OFFER_STATUS_LABELS, OFFER_STATUS_COLORS, isActiveHold, isReservation } from '@/lib/offers'
import type { OfferStatus } from '@prisma/client'

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

// Orden de columnas del tablero (los terminales van agrupados al final)
const BOARD_COLUMNS: OfferStatus[] = ['PROPUESTA', 'CONTRAOFERTA', 'ACEPTADA', 'CONVERTIDA']
const CLOSED: OfferStatus[] = ['RECHAZADA', 'EXPIRADA', 'RETIRADA', 'CANCELADA']

export default async function OfertasPage() {
  await requireAgente()

  const offers = await db.offer.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      vehicle: { select: { brand: true, model: true, year: true, sellerLeadId: true } },
      buyerLead: { select: { id: true, name: true } },
    },
  })

  const rows = offers.map((o) => ({
    id: o.id,
    amount: Number(o.amount),
    depositAmount: o.depositAmount ? Number(o.depositAmount) : null,
    status: o.status,
    reservedUntil: o.reservedUntil,
    buyerName: o.buyerLead.name,
    buyerId: o.buyerLead.id,
    vehicleLabel: `${o.vehicle.brand} ${o.vehicle.model} (${o.vehicle.year})`,
    sellerLeadId: o.vehicle.sellerLeadId,
  }))

  const active = rows.filter((r) => isActiveHold(r.status))
  const reservations = rows.filter((r) => isReservation(r.status, r.depositAmount))
  const pipelineValue = active.reduce((s, r) => s + r.amount, 0)
  const depositsHeld = reservations.reduce((s, r) => s + (r.depositAmount ?? 0), 0)

  const byStatus = new Map<OfferStatus, typeof rows>()
  for (const r of rows) {
    const list = byStatus.get(r.status) ?? []
    list.push(r)
    byStatus.set(r.status, list)
  }
  const closedRows = CLOSED.flatMap((s) => byStatus.get(s) ?? [])

  return (
    <div className="-mx-6 -mt-6">
      <header className="z-20 flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-[#e6e9ee] bg-white px-4 py-2 md:px-8 lg:sticky lg:top-0 lg:h-[73px] lg:py-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#586173]">
            CRM · Transacción
          </div>
          <h1 className="mt-0.5 text-[20px] font-bold tracking-tight text-[#141922]">
            Ofertas y reservas
          </h1>
        </div>
      </header>

      <div className="space-y-5 px-4 pb-16 pt-4 md:px-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Ofertas vivas', value: String(active.length) },
            { label: 'Reservas activas', value: String(reservations.length) },
            { label: 'Valor en negociación', value: EUR(pipelineValue) },
            { label: 'Señales retenidas', value: EUR(depositsHeld) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-[#e6e9ee] bg-white px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#586173]">
                {k.label}
              </p>
              <p className="mt-1 text-xl font-bold tracking-[-0.02em] text-[#141922]">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Tablero por estado */}
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[900px] gap-3"
            style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
          >
            {BOARD_COLUMNS.map((status) => {
              const list = byStatus.get(status) ?? []
              return (
                <div key={status} className="rounded-xl border border-[#e6e9ee] bg-[#f8fafc]">
                  <div className="flex items-center justify-between border-b border-[#e6e9ee] px-3 py-2">
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#141922]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: OFFER_STATUS_COLORS[status] }}
                      />
                      {OFFER_STATUS_LABELS[status]}
                    </span>
                    <span className="rounded-full bg-white px-1.5 py-0.5 font-mono text-[11px] text-[#586173]">
                      {list.length}
                    </span>
                  </div>
                  <div className="space-y-2 p-2">
                    {list.length === 0 ? (
                      <p className="px-1 py-6 text-center text-[11px] text-[#8b94a3]">—</p>
                    ) : (
                      list.map((r) => <OfferMini key={r.id} r={r} />)
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Cerradas */}
        {closedRows.length > 0 && (
          <details className="rounded-xl border border-[#e6e9ee] bg-white">
            <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-[#586173]">
              Cerradas ({closedRows.length})
            </summary>
            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {closedRows.map((r) => (
                <OfferMini key={r.id} r={r} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

function OfferMini({
  r,
}: {
  r: {
    id: string
    amount: number
    depositAmount: number | null
    status: OfferStatus
    reservedUntil: Date | null
    buyerName: string
    buyerId: string
    vehicleLabel: string
    sellerLeadId: string
  }
}) {
  return (
    <div className="rounded-lg border border-[#e6e9ee] bg-white p-3 text-[13px]">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-[#141922]">{EUR(r.amount)}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            background: `${OFFER_STATUS_COLORS[r.status]}1a`,
            color: OFFER_STATUS_COLORS[r.status],
          }}
        >
          {OFFER_STATUS_LABELS[r.status]}
        </span>
      </div>
      <Link
        href={`/compradores/${r.buyerId}`}
        className="mt-1 block truncate font-medium text-[#141922] hover:underline"
      >
        {r.buyerName}
      </Link>
      <Link
        href={`/vendedores/${r.sellerLeadId}`}
        className="block truncate text-[12px] text-[#586173] hover:underline"
      >
        {r.vehicleLabel}
      </Link>
      {r.depositAmount != null && (
        <p className="mt-1 text-[11px] text-cyan-700">
          Señal {EUR(r.depositAmount)}
          {r.reservedUntil &&
            ` · hasta ${r.reservedUntil.toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              timeZone: 'Europe/Madrid',
            })}`}
        </p>
      )}
    </div>
  )
}
