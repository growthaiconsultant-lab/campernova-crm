import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getSalesMonthOverMonth } from '@/lib/dashboard/queries'
import { getMonthlyNetMargin, getAverageDaysInStock } from '@/lib/dashboard/metrics'
import { getDireccionKpis } from '@/lib/kpi/direccion'
import { KpiCard } from '@/components/analytics/kpi-card'
import { FunnelChart } from '@/components/analytics/funnel-chart'
import { DashboardFilters } from '@/app/(backoffice)/dashboard/dashboard-filters'
import { sem, KPI_TARGETS } from '@/lib/kpi/thresholds'

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export default async function DireccionDashboardPage({
  searchParams,
}: {
  searchParams: { agent?: string }
}) {
  const currentUser = await requireAuth()
  const isAdmin = currentUser.role === 'ADMIN'
  const isMarketing = currentUser.role === 'MARKETING'
  if (!isAdmin && !isMarketing) redirect('/dashboard?error=forbidden')

  const filter = { agentId: isAdmin ? (searchParams.agent ?? null) : null }

  const [kpis, sales, margin, daysStock, agents] = await Promise.all([
    getDireccionKpis(db, filter),
    getSalesMonthOverMonth(db, filter),
    getMonthlyNetMargin(db, filter),
    getAverageDaysInStock(db, filter),
    isAdmin
      ? db.user.findMany({
          where: { active: true, role: { in: ['ADMIN', 'AGENTE'] } },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ])

  const marginPct =
    margin.grossRevenue > 0 ? Math.round((margin.netMargin / margin.grossRevenue) * 100) : 0
  const avgDays = daysStock.averageDays ?? 0

  return (
    <div className="min-h-full">
      <header className="z-20 flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 md:px-8 lg:sticky lg:top-0 lg:h-[73px] lg:py-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Analytics · Dirección
          </div>
          <h1 className="mt-0.5 text-[20px] font-bold tracking-tight text-foreground">
            Dashboard Dirección
          </h1>
        </div>
        {isAdmin && <DashboardFilters agents={agents} currentAgentId={filter.agentId} />}
      </header>

      <div className="space-y-8 px-4 pb-16 pt-6 md:px-8">
        {/* North Star + KPIs ejecutivos */}
        <section>
          <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-primary">
            North Star · operaciones estructuradas
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Operaciones estructuradas"
              value={String(kpis.structuredOperations)}
              sub={`${kpis.structuredPct}% del total`}
              semaphore={
                kpis.structuredPct >= 50 ? 'green' : kpis.structuredPct >= 25 ? 'amber' : 'red'
              }
              tooltip="Compradores activos con al menos un match y próxima acción registrada. Es la métrica que mide si construimos infraestructura, no solo ventas."
              href="/compradores"
            />
            <KpiCard
              label="Ventas del mes"
              value={String(sales.current)}
              deltaPct={sales.pctChange != null ? Math.round(sales.pctChange) : null}
              semaphore={sem.monthlySales(sales.current)}
              sub={`objetivo ${KPI_TARGETS.monthlySales}`}
              tooltip="Vehículos vendidos este mes vs el mes anterior. Objetivo: 7/mes."
            />
            <KpiCard
              label="Margen bruto (mes)"
              value={EUR(margin.netMargin)}
              semaphore={sem.marginPct(marginPct)}
              sub={`${marginPct}% · mín 4%`}
              tooltip="Margen neto de las ventas del mes y su % sobre ingresos. Umbral mínimo: 4% por operación."
            />
            <KpiCard
              label="Compradores activos"
              value={String(kpis.activeBuyers)}
              tooltip="Compradores en estados activos (nuevo, contactado, cualificado, en negociación)."
              href="/compradores"
            />
            <KpiCard
              label="Tiempo medio de venta"
              value={`${avgDays} d`}
              semaphore={sem.daysToSell(avgDays)}
              tooltip="Días medios desde publicación hasta venta. Objetivo <15 días."
            />
          </div>
        </section>

        {/* Stock, demanda y confianza */}
        <section>
          <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Stock, demanda y confianza
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Vehículos publicados"
              value={String(kpis.publishedVehicles)}
              href="/vehiculos"
            />
            <KpiCard
              label="Vehículos captados"
              value={String(kpis.capturedVehicles)}
              href="/vendedores"
            />
            <KpiCard
              label="Con demanda activa"
              value={String(kpis.vehiclesWithDemand)}
              semaphore={kpis.vehiclesWithDemand > 0 ? 'green' : 'gray'}
              tooltip="Vehículos en stock con ≥1 comprador activo compatible (match ≥60). Palanca comercial y de captación."
            />
            <KpiCard
              label="Matches útiles"
              value={String(kpis.usefulMatches)}
              tooltip="Matches con score ≥70 sin bloqueo duro. Mide la inteligencia comercial accionable."
            />
            <KpiCard
              label="% Trust Passport"
              value={`${kpis.trustPct}%`}
              semaphore={sem.trustPct(kpis.trustPct)}
              sub={`objetivo ${KPI_TARGETS.trustPassportPct}%`}
              tooltip="% del stock captado con sello 'Verificado por CampersNova'. Objetivo ≥70%."
            />
          </div>
        </section>

        {/* Funnels */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">Funnel comprador</h2>
            <FunnelChart stages={kpis.buyerFunnel} />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">Funnel vehículo</h2>
            <FunnelChart stages={kpis.vehicleFunnel} />
          </div>
        </section>

        <p className="text-[11px] text-muted-foreground">
          Actualizado en tiempo real · datos calculados server-side.
        </p>
      </div>
    </div>
  )
}
