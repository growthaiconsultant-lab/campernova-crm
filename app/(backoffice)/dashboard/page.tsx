import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  SELLER_LEAD_STATUS_LABELS,
  SELLER_LEAD_STATUS_CLASSES,
  BUYER_LEAD_STATUS_LABELS,
  BUYER_LEAD_STATUS_CLASSES,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUS_CLASSES,
} from '@/lib/state-machine'
import {
  getSellerLeadCounts,
  getBuyerLeadCounts,
  getVehicleCounts,
  getSalesMonthOverMonth,
  getProFunnel,
  type DashboardFilter,
} from '@/lib/dashboard/queries'
import {
  aggregateMediansByState,
  formatDuration,
  type EntityActivities,
  type StateMedianRow,
} from '@/lib/dashboard/time-in-state'
import { DashboardFilters } from './dashboard-filters'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { SellerLeadStatus, BuyerLeadStatus, VehicleStatus } from '@prisma/client'

const ACTIVE_SELLER_STATUSES: SellerLeadStatus[] = [
  'NUEVO',
  'CONTACTADO',
  'CUALIFICADO',
  'EN_NEGOCIACION',
]
const ACTIVE_BUYER_STATUSES: BuyerLeadStatus[] = [
  'NUEVO',
  'CONTACTADO',
  'CUALIFICADO',
  'EN_NEGOCIACION',
]

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { agent?: string }
}) {
  const currentUser = await requireAuth()

  // Si el usuario no es admin, forzamos el filtro a su propio agentId.
  const isAdmin = currentUser.role === 'ADMIN'
  const requestedAgentId = searchParams.agent ?? null
  const effectiveAgentId = isAdmin ? requestedAgentId : currentUser.id
  const filter: DashboardFilter = { agentId: effectiveAgentId }

  const [
    sellerCounts,
    buyerCounts,
    vehicleCounts,
    salesMoM,
    proFunnel,
    agents,
    sellerStateMedians,
    buyerStateMedians,
    vehicleStateMedians,
  ] = await Promise.all([
    getSellerLeadCounts(db, filter),
    getBuyerLeadCounts(db, filter),
    getVehicleCounts(db, filter),
    getSalesMonthOverMonth(db, filter),
    getProFunnel(db, filter),
    isAdmin
      ? db.user.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    fetchSellerStateMedians(filter),
    fetchBuyerStateMedians(filter),
    fetchVehicleStateMedians(filter),
  ])

  const totalSellerActive = sumWhere(sellerCounts, ACTIVE_SELLER_STATUSES)
  const totalBuyerActive = sumWhere(buyerCounts, ACTIVE_BUYER_STATUSES)
  const totalPublicados = sumWhere(vehicleCounts, ['PUBLICADO'])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Resumen del pipeline · {new Date().toLocaleDateString('es-ES')}
          </p>
        </div>
        {isAdmin && <DashboardFilters agents={agents} currentAgentId={requestedAgentId} />}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard
          label="Vendedores activos"
          value={totalSellerActive}
          hint="excluye cerrados/descartados"
        />
        <KPICard
          label="Compradores activos"
          value={totalBuyerActive}
          hint="excluye cerrados/perdidos"
        />
        <KPICard label="Vehículos publicados" value={totalPublicados} hint="ahora mismo" />
        <SalesKPI
          current={salesMoM.current}
          previous={salesMoM.previous}
          delta={salesMoM.delta}
          pctChange={salesMoM.pctChange}
        />
      </div>

      {/* Distribución por estado */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DistributionCard
          title="Vendedores por estado"
          counts={sellerCounts}
          labels={SELLER_LEAD_STATUS_LABELS}
          classes={SELLER_LEAD_STATUS_CLASSES}
          order={['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO', 'DESCARTADO']}
        />
        <DistributionCard
          title="Compradores por estado"
          counts={buyerCounts}
          labels={BUYER_LEAD_STATUS_LABELS}
          classes={BUYER_LEAD_STATUS_CLASSES}
          order={['NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO', 'PERDIDO']}
        />
        <DistributionCard
          title="Vehículos por estado"
          counts={vehicleCounts}
          labels={VEHICLE_STATUS_LABELS}
          classes={VEHICLE_STATUS_CLASSES}
          order={['NUEVO', 'TASADO', 'PUBLICADO', 'RESERVADO', 'VENDIDO', 'DESCARTADO']}
        />
      </div>

      {/* Funnel Pro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversión canal Pro</CardTitle>
        </CardHeader>
        <CardContent>
          <ProFunnelView
            leadsPro={proFunnel.leadsPro}
            publicados={proFunnel.publicados}
            vendidos={proFunnel.vendidos}
            pubRate={proFunnel.pubRate}
            vendRate={proFunnel.vendRate}
            totalRate={proFunnel.totalRate}
          />
        </CardContent>
      </Card>

      {/* Tiempo medio por estado */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StateMediansCard
          title="Tiempo medio · vendedores"
          rows={sellerStateMedians}
          labels={SELLER_LEAD_STATUS_LABELS}
        />
        <StateMediansCard
          title="Tiempo medio · compradores"
          rows={buyerStateMedians}
          labels={BUYER_LEAD_STATUS_LABELS}
        />
        <StateMediansCard
          title="Tiempo medio · vehículos"
          rows={vehicleStateMedians}
          labels={VEHICLE_STATUS_LABELS}
        />
      </div>
    </div>
  )
}

// ── helpers locales ───────────────────────────────────────────────

function sumWhere<T extends string>(counts: { status: T; count: number }[], statuses: T[]): number {
  const set = new Set(statuses)
  return counts.filter((c) => set.has(c.status)).reduce((a, c) => a + c.count, 0)
}

async function fetchSellerStateMedians(
  filter: DashboardFilter
): Promise<StateMedianRow<SellerLeadStatus>[]> {
  const leads = await db.sellerLead.findMany({
    where: filter.agentId ? { agentId: filter.agentId } : undefined,
    select: {
      createdAt: true,
      activities: {
        where: { type: 'CAMBIO_ESTADO' },
        select: { createdAt: true, content: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  const entities: EntityActivities<SellerLeadStatus>[] = leads.map((l) => ({
    initialStatus: 'NUEVO' as SellerLeadStatus,
    createdAt: l.createdAt,
    activities: l.activities.filter((a) => !a.content?.startsWith('Vehículo:')),
  }))
  return aggregateMediansByState<SellerLeadStatus>(entities, SELLER_LEAD_STATUS_LABELS)
}

async function fetchBuyerStateMedians(
  filter: DashboardFilter
): Promise<StateMedianRow<BuyerLeadStatus>[]> {
  const leads = await db.buyerLead.findMany({
    where: filter.agentId ? { agentId: filter.agentId } : undefined,
    select: {
      createdAt: true,
      activities: {
        where: { type: 'CAMBIO_ESTADO' },
        select: { createdAt: true, content: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  const entities: EntityActivities<BuyerLeadStatus>[] = leads.map((l) => ({
    initialStatus: 'NUEVO' as BuyerLeadStatus,
    createdAt: l.createdAt,
    activities: l.activities,
  }))
  return aggregateMediansByState<BuyerLeadStatus>(entities, BUYER_LEAD_STATUS_LABELS)
}

async function fetchVehicleStateMedians(
  filter: DashboardFilter
): Promise<StateMedianRow<VehicleStatus>[]> {
  // Las activities de vehículo cuelgan del SellerLead. Filtramos las que
  // empiezan por "Vehículo:" en el content (formato establecido en CAM-30).
  const vehicles = await db.vehicle.findMany({
    where: filter.agentId ? { sellerLead: { agentId: filter.agentId } } : undefined,
    select: {
      createdAt: true,
      sellerLead: {
        select: {
          activities: {
            where: { type: 'CAMBIO_ESTADO', content: { startsWith: 'Vehículo:' } },
            select: { createdAt: true, content: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  })
  const entities: EntityActivities<VehicleStatus>[] = vehicles.map((v) => ({
    initialStatus: 'NUEVO' as VehicleStatus,
    createdAt: v.createdAt,
    activities: v.sellerLead.activities,
  }))
  return aggregateMediansByState<VehicleStatus>(entities, VEHICLE_STATUS_LABELS)
}

// ── subcomponentes ────────────────────────────────────────────────

function KPICard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function SalesKPI({
  current,
  previous,
  delta,
  pctChange,
}: {
  current: number
  previous: number
  delta: number
  pctChange: number | null
}) {
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const color =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Ventas este mes
        </p>
        <p className="mt-1 text-3xl font-bold">{current}</p>
        <div className={`mt-1 flex items-center gap-1 text-xs ${color}`}>
          <Icon className="h-3 w-3" />
          <span>
            {delta > 0 ? '+' : ''}
            {delta} vs mes anterior ({previous})
            {pctChange !== null && ` · ${pctChange > 0 ? '+' : ''}${pctChange.toFixed(0)}%`}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function DistributionCard<T extends string>({
  title,
  counts,
  labels,
  classes,
  order,
}: {
  title: string
  counts: { status: T; count: number }[]
  labels: Record<T, string>
  classes: Record<T, string>
  order: T[]
}) {
  const total = counts.reduce((a, c) => a + c.count, 0)
  const map = new Map(counts.map((c) => [c.status, c.count]))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <ul className="space-y-2">
            {order.map((status) => {
              const count = map.get(status) ?? 0
              const pct = total === 0 ? 0 : (count / total) * 100
              return (
                <li key={status}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes[status]}`}
                    >
                      {labels[status]}
                    </span>
                    <span className="text-sm font-semibold">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-campernova-accent h-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
            <li className="border-t pt-2 text-xs text-muted-foreground">Total: {total}</li>
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ProFunnelView({
  leadsPro,
  publicados,
  vendidos,
  pubRate,
  vendRate,
  totalRate,
}: {
  leadsPro: number
  publicados: number
  vendidos: number
  pubRate: number | null
  vendRate: number | null
  totalRate: number | null
}) {
  if (leadsPro === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay leads del canal Pro.</p>
  }

  const max = leadsPro
  const stages = [
    { label: 'Leads recibidos (Pro)', value: leadsPro, pct: 100, rate: null as number | null },
    {
      label: 'Llegaron a publicado',
      value: publicados,
      pct: (publicados / max) * 100,
      rate: pubRate,
    },
    { label: 'Vendidos', value: vendidos, pct: (vendidos / max) * 100, rate: vendRate },
  ]

  return (
    <div className="space-y-3">
      {stages.map((s) => (
        <div key={s.label}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{s.label}</span>
            <span className="text-sm">
              <span className="font-semibold">{s.value}</span>
              {s.rate !== null && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {s.rate.toFixed(0)}% del paso anterior
                </span>
              )}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-md bg-muted">
            <div
              className="bg-campernova-primary h-full transition-all"
              style={{ width: `${Math.max(s.pct, 0)}%` }}
            />
          </div>
        </div>
      ))}
      {totalRate !== null && (
        <p className="border-t pt-3 text-sm text-muted-foreground">
          Conversión total lead Pro → venta:{' '}
          <strong className="text-foreground">{totalRate.toFixed(1)}%</strong>
        </p>
      )}
    </div>
  )
}

function StateMediansCard<T extends string>({
  title,
  rows,
  labels,
}: {
  title: string
  rows: StateMedianRow<T>[]
  labels: Record<T, string>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin transiciones completadas todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 font-medium">Estado</th>
                <th className="py-1.5 text-right font-medium">Mediana</th>
                <th className="py-1.5 text-right font-medium">n</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.status} className="border-b last:border-0">
                  <td className="py-1.5">{labels[r.status]}</td>
                  <td className="py-1.5 text-right font-medium">{formatDuration(r.medianMs)}</td>
                  <td className="py-1.5 text-right text-xs text-muted-foreground">
                    {r.sampleSize}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
