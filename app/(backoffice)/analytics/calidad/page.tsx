import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getCalidadKpis } from '@/lib/kpi/calidad'
import { KpiCard } from '@/components/analytics/kpi-card'
import { BarList } from '@/components/analytics/bar-list'
import { ActionableTable } from '@/components/analytics/actionable-table'
import { DashboardFilters } from '@/app/(backoffice)/dashboard/dashboard-filters'
import { sem } from '@/lib/kpi/thresholds'
import { Download } from 'lucide-react'

export default async function CalidadDashboardPage({
  searchParams,
}: {
  searchParams: { agent?: string }
}) {
  const currentUser = await requireAuth()
  const role = currentUser.role
  if (!['ADMIN', 'AGENTE', 'MARKETING'].includes(role)) redirect('/dashboard?error=forbidden')
  const isAdmin = role === 'ADMIN'

  const filter = { agentId: isAdmin ? (searchParams.agent ?? null) : null }
  const [q, agents] = await Promise.all([
    getCalidadKpis(db, filter),
    isAdmin
      ? db.user.findMany({
          where: { active: true, role: { in: ['ADMIN', 'AGENTE'] } },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ])

  const csvHref = `/api/analytics/incompletos.csv${filter.agentId ? `?agent=${filter.agentId}` : ''}`

  return (
    <div className="min-h-full">
      <header className="z-20 flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 md:px-8 lg:sticky lg:top-0 lg:h-[73px] lg:py-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Analytics · Calidad de Datos
          </div>
          <h1 className="mt-0.5 text-[20px] font-bold tracking-tight text-foreground">
            Calidad de Datos
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={csvHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Link>
          {isAdmin && <DashboardFilters agents={agents} currentAgentId={filter.agentId} />}
        </div>
      </header>

      <div className="space-y-8 px-4 pb-16 pt-6 md:px-8">
        <section>
          <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Scores de completitud
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label="Completitud comprador"
              value={`${q.buyerAvg}%`}
              semaphore={sem.dataPct(q.buyerAvg)}
              tooltip="Completitud media de las fichas de comprador activas. Objetivo ≥80%."
            />
            <KpiCard
              label="Completitud vehículo"
              value={`${q.vehicleAvg}%`}
              semaphore={sem.dataPct(q.vehicleAvg)}
              tooltip="Completitud media de las fichas de vehículo en stock. Objetivo ≥80%."
            />
            <KpiCard
              label="Trazabilidad eventos"
              value={`${q.eventTraceabilityPct}%`}
              semaphore={sem.dataPct(q.eventTraceabilityPct)}
              tooltip="% de eventos KPI con actor u origen registrado. Los KPIs deben ser auditables."
            />
            <KpiCard
              label="Incidencias críticas"
              value={String(q.criticalCount)}
              higherIsBetter={false}
              semaphore={q.criticalCount === 0 ? 'green' : q.criticalCount <= 10 ? 'amber' : 'red'}
              tooltip="Suma de entidades con datos críticos incompletos."
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">
              Completitud por entidad
            </h2>
            <BarList
              items={q.averages.map((a) => ({ label: a.label, count: a.pct }))}
              color="#2563eb"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">Incidencias críticas</h2>
            <BarList
              items={[
                { label: 'Compradores sin presupuesto', count: q.buyersNoBudget },
                { label: 'Compradores sin acción', count: q.buyersNoAction },
                { label: 'Vehículos sin valoración', count: q.vehiclesNoValuation },
                { label: 'Ventas sin margen', count: q.salesNoMargin },
              ].filter((i) => i.count > 0)}
              color="#dc2626"
              emptyText="Sin incidencias críticas. 👌"
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-[14px] font-semibold text-foreground">
            Fichas de vehículo incompletas
          </h2>
          <ActionableTable
            columns={[
              { key: 'name', label: 'Vehículo' },
              { key: 'detail', label: 'Completitud' },
            ]}
            rows={q.incompleteRows.map((r) => ({
              id: r.id,
              href: r.href,
              semaphore: 'amber',
              cells: { name: r.name, detail: r.detail },
            }))}
            emptyText="Todas las fichas de vehículo están completas. 👌"
          />
        </section>

        <p className="text-[11px] text-muted-foreground">
          Actualizado en tiempo real · datos calculados server-side.
        </p>
      </div>
    </div>
  )
}
