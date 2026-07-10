import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { OFFER_STATUS_LABELS, OFFER_STATUS_COLORS, isActiveHold, isReservation } from '@/lib/offers'
import { RESERVATION_STALE_DAYS } from '@/lib/kpi/thresholds'
import { Eyebrow, Card, KpiCard, ActionableTable, HexPill, ButtonLink } from '@/components/redesign'
import type { Column } from '@/components/redesign'
import type { OfferStatus } from '@prisma/client'

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const KEUR = (n: number) => `${Math.round(n / 1000)} K€`
const DATE = (d: Date) =>
  d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', timeZone: 'Europe/Madrid' })

interface OfferRow {
  id: string
  ref: string
  amount: number
  depositAmount: number | null
  status: OfferStatus
  reservedUntil: Date | null
  updatedAt: Date
  buyerName: string
  buyerId: string
  vehicleLabel: string
  sellerLeadId: string | null
}

export default async function OfertasPage() {
  await requireAgente()

  const offers = await db.offer.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      vehicle: { select: { brand: true, model: true, year: true, sellerLeadId: true } },
      buyerLead: { select: { id: true, name: true } },
    },
  })

  const rows: OfferRow[] = offers.map((o) => ({
    id: o.id,
    ref: `#${o.id.slice(-4).toUpperCase()}`,
    amount: Number(o.amount),
    depositAmount: o.depositAmount ? Number(o.depositAmount) : null,
    status: o.status,
    reservedUntil: o.reservedUntil,
    updatedAt: o.updatedAt,
    buyerName: o.buyerLead.name,
    buyerId: o.buyerLead.id,
    vehicleLabel: `${o.vehicle.brand} ${o.vehicle.model} (${o.vehicle.year})`,
    sellerLeadId: o.vehicle.sellerLeadId,
  }))

  const active = rows.filter((r) => isActiveHold(r.status))
  const reservations = rows.filter((r) => isReservation(r.status, r.depositAmount))

  const offerValue = active.reduce((s, r) => s + r.amount, 0)
  const avgDeposit = reservations.length
    ? reservations.reduce((s, r) => s + (r.depositAmount ?? 0), 0) / reservations.length
    : 0

  // Tasa de aceptación = aceptadas+convertidas / (esas + rechazadas)
  const accepted = rows.filter((r) => r.status === 'ACEPTADA' || r.status === 'CONVERTIDA').length
  const rejected = rows.filter((r) => r.status === 'RECHAZADA').length
  const acceptancePct =
    accepted + rejected ? Math.round((accepted / (accepted + rejected)) * 100) : 0

  // Reservas paradas: >N días sin avanzar (o con reserva vencida)
  const now = Date.now()
  const staleMs = RESERVATION_STALE_DAYS * 86_400_000
  const stalledIds = new Set(
    reservations
      .filter(
        (r) =>
          now - new Date(r.updatedAt).getTime() > staleMs ||
          (r.reservedUntil && new Date(r.reservedUntil).getTime() < now)
      )
      .map((r) => r.id)
  )

  const buyerHref = (r: OfferRow) => `/compradores/${r.buyerId}`

  const offerCols: Column<OfferRow>[] = [
    { key: 'buyer', header: 'Comprador', cell: (r) => r.buyerName },
    {
      key: 'vehicle',
      header: 'Vehículo',
      cell: (r) => <span className="font-medium text-ink2">{r.vehicleLabel}</span>,
    },
    { key: 'amount', header: 'Importe', mono: true, align: 'right', cell: (r) => EUR(r.amount) },
    {
      key: 'status',
      header: 'Estado',
      cell: (r) => (
        <HexPill hex={OFFER_STATUS_COLORS[r.status]}>{OFFER_STATUS_LABELS[r.status]}</HexPill>
      ),
    },
    {
      key: 'plazo',
      header: 'Plazo',
      mono: true,
      cell: (r) =>
        r.reservedUntil ? (
          <span className="text-ink2">{DATE(new Date(r.reservedUntil))}</span>
        ) : (
          <span className="text-ink3">—</span>
        ),
    },
    {
      key: '__cta',
      header: '',
      align: 'right',
      cell: (r) => (
        <ButtonLink href={buyerHref(r)} variant="secondary" size="sm">
          Ver ficha
        </ButtonLink>
      ),
    },
  ]

  const reservationCols: Column<OfferRow>[] = [
    {
      key: 'ref',
      header: 'Reserva',
      mono: true,
      cell: (r) => (
        <div>
          <div className="text-ink">{r.ref}</div>
          <div className="mt-0.5 text-[11px] font-normal text-ink3">{r.vehicleLabel}</div>
        </div>
      ),
    },
    { key: 'buyer', header: 'Comprador', cell: (r) => r.buyerName },
    {
      key: 'deposit',
      header: 'Señal',
      mono: true,
      align: 'right',
      cell: (r) => (r.depositAmount ? EUR(r.depositAmount) : <span className="text-ink3">—</span>),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (r) =>
        stalledIds.has(r.id) ? (
          <HexPill hex="#d64545">En riesgo</HexPill>
        ) : (
          <HexPill hex={OFFER_STATUS_COLORS[r.status]}>{OFFER_STATUS_LABELS[r.status]}</HexPill>
        ),
    },
    {
      key: '__cta',
      header: '',
      align: 'right',
      cell: (r) => (
        <ButtonLink href={buyerHref(r)} variant="secondary" size="sm">
          Ver ficha
        </ButtonLink>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Título de módulo (en contenido; el chrome global vive en el header 60px) */}
      <div className="mb-[18px]">
        <Eyebrow>CRM · Transacción</Eyebrow>
        <h1 className="mt-1 font-hanken text-[23px] font-bold tracking-[-0.02em] text-ink">
          Ofertas y reservas
        </h1>
      </div>

      {/* 4 KPI cards */}
      <div className="mb-[18px] grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <KpiCard label="Ofertas activas" value={active.length} note={`valor ${KEUR(offerValue)}`} />
        <KpiCard
          label="Tasa de aceptación"
          value={`${acceptancePct}%`}
          tone={acceptancePct >= 50 ? 'good' : acceptancePct >= 25 ? 'warn' : 'neutral'}
          note={`${accepted} aceptadas · ${rejected} rechazadas`}
        />
        <KpiCard
          label="Reservas abiertas"
          value={reservations.length}
          note={reservations.length ? `señal media ${EUR(Math.round(avgDeposit))}` : 'sin señales'}
        />
        <KpiCard
          label="Reservas paradas"
          value={stalledIds.size}
          tone={stalledIds.size ? 'bad' : 'good'}
          note={`>${RESERVATION_STALE_DAYS} días sin avanzar`}
        />
      </div>

      {/* Card con las 2 tablas accionables */}
      <Card pad={false}>
        <div className="px-[18px] pb-3 pt-[15px] font-hanken text-[15px] font-bold text-ink">
          Ofertas activas
        </div>
        <ActionableTable
          columns={offerCols}
          rows={active}
          rowKey={(r) => r.id}
          rowHref={buyerHref}
          mobileCard={(r) => (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-hanken text-[13.5px] font-semibold text-ink">
                  {r.buyerName}
                </span>
                <HexPill hex={OFFER_STATUS_COLORS[r.status]} className="shrink-0">
                  {OFFER_STATUS_LABELS[r.status]}
                </HexPill>
              </div>
              <div className="mt-0.5 truncate font-hanken text-[11.5px] font-medium text-ink3">
                {r.vehicleLabel}
              </div>
              <div className="mt-2 font-mono text-[13px] font-semibold text-ink">
                {EUR(r.amount)}
              </div>
            </>
          )}
          empty={
            <div className="px-[18px] pb-6 pt-2 font-hanken text-[13px] text-ink3">
              No hay ofertas activas. Registra una oferta desde la ficha de un comprador.
            </div>
          }
        />
        <div className="border-t border-line2 px-[18px] pb-3 pt-[15px] font-hanken text-[15px] font-bold text-ink">
          Reservas en curso
        </div>
        <ActionableTable
          columns={reservationCols}
          rows={reservations}
          rowKey={(r) => r.id}
          rowHref={buyerHref}
          mobileCard={(r) => (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[12.5px] font-semibold text-ink">
                  {r.ref} · {r.buyerName}
                </span>
                {stalledIds.has(r.id) ? (
                  <HexPill hex="#d64545" className="shrink-0">
                    En riesgo
                  </HexPill>
                ) : (
                  <HexPill hex={OFFER_STATUS_COLORS[r.status]} className="shrink-0">
                    {OFFER_STATUS_LABELS[r.status]}
                  </HexPill>
                )}
              </div>
              <div className="mt-0.5 truncate font-hanken text-[11.5px] font-medium text-ink3">
                {r.vehicleLabel}
              </div>
              <div className="mt-2 font-mono text-[13px] font-semibold text-ink">
                {r.depositAmount ? `Señal ${EUR(r.depositAmount)}` : 'Sin señal'}
              </div>
            </>
          )}
          empty={
            <div className="px-[18px] pb-6 pt-2 font-hanken text-[13px] text-ink3">
              No hay reservas en curso. Una oferta aceptada con señal se convierte en reserva.
            </div>
          }
        />
      </Card>
    </div>
  )
}
