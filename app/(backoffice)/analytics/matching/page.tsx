import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getMatchingKpis } from '@/lib/kpi/matching'
import { KpiCard } from '@/components/analytics/kpi-card'
import { FunnelChart } from '@/components/analytics/funnel-chart'
import { BarList } from '@/components/analytics/bar-list'
import { ActionableTable } from '@/components/analytics/actionable-table'
import { DashboardFilters } from '@/app/(backoffice)/dashboard/dashboard-filters'

export default async function MatchingDashboardPage({
  searchParams,
}: {
  searchParams: { agent?: string }
}) {
  const currentUser = await requireAuth()
  const role = currentUser.role
  if (!['ADMIN', 'AGENTE', 'MARKETING'].includes(role)) redirect('/dashboard?error=forbidden')
  const isAdmin = role === 'ADMIN'
  const isAgente = role === 'AGENTE'

  const filter = { agentId: isAgente ? currentUser.id : (searchParams.agent ?? null) }

  const [m, agents] = await Promise.all([
    getMatchingKpis(db, filter),
    isAdmin
      ? db.user.findMany({
          where: { active: true, role: { in: ['ADMIN', 'AGENTE'] } },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ])

  return (
    <div className="min-h-full">
      <header className="z-20 flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 md:px-8 lg:sticky lg:top-0 lg:h-[73px] lg:py-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Analytics · Matching
          </div>
          <h1 className="mt-0.5 text-[20px] font-bold tracking-tight text-foreground">
            Dashboard Matching
          </h1>
        </div>
        {isAdmin && <DashboardFilters agents={agents} currentAgentId={filter.agentId} />}
      </header>

      <div className="space-y-8 px-4 pb-16 pt-6 md:px-8">
        <section>
          <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Calidad del matching
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Matches generados"
              value={String(m.total)}
              tooltip="Total de matches comprador-vehículo calculados."
            />
            <KpiCard
              label="Matches útiles"
              value={String(m.useful)}
              semaphore={m.useful > 0 ? 'green' : 'gray'}
              tooltip="Matches con score ≥70. Inteligencia comercial accionable."
            />
            <KpiCard
              label="Score medio"
              value={`${m.avgScore}`}
              semaphore={m.avgScore >= 70 ? 'green' : m.avgScore >= 50 ? 'amber' : 'red'}
              tooltip="Score medio de todos los matches. Mide el encaje entre oferta y demanda."
            />
            <KpiCard
              label="Match → oferta"
              value={`${m.offerConversionPct}%`}
              sub={`${m.matchesWithOffer} con oferta`}
              tooltip="% de matches que han derivado en una oferta registrada. Mide el impacto real del matching en negocio."
            />
            <KpiCard
              label="Rechazados"
              value={String(m.rejected)}
              higherIsBetter={false}
              tooltip="Matches marcados como rechazados."
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">Embudo de matches</h2>
            <FunnelChart stages={m.funnel} />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">
              Distribución de score
            </h2>
            <BarList items={m.scoreBuckets} />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-[14px] font-semibold text-foreground">
            Vehículos con más demanda compatible
          </h2>
          <ActionableTable
            columns={[
              { key: 'name', label: 'Vehículo' },
              { key: 'detail', label: 'Demanda' },
            ]}
            rows={m.topDemandRows.map((r) => ({
              id: r.id,
              href: r.href,
              semaphore: 'green',
              cells: { name: r.name, detail: r.detail },
            }))}
            emptyText="Sin vehículos con demanda activa compatible todavía."
          />
        </section>

        <p className="text-[11px] text-muted-foreground">
          Actualizado en tiempo real · datos calculados server-side.
        </p>
      </div>
    </div>
  )
}
