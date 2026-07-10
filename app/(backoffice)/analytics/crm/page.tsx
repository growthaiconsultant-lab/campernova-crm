import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getCrmKpis, type LostReasonRow } from '@/lib/kpi/crm'
import { getFlowKpis } from '@/lib/kpi/flow'
import { resolveRange } from '@/lib/kpi/range'
import { getDireccionKpis } from '@/lib/kpi/direccion'
import { KpiCard } from '@/components/analytics/kpi-card'
import { FunnelChart } from '@/components/analytics/funnel-chart'
import { ActionableTable } from '@/components/analytics/actionable-table'
import { DashboardFilters } from '@/app/(backoffice)/dashboard/dashboard-filters'
import { sem } from '@/lib/kpi/thresholds'

function LostBars({ rows }: { rows: LostReasonRow[] }) {
  if (rows.length === 0)
    return (
      <p className="py-4 text-center text-[13px] text-muted-foreground">
        Sin pérdidas registradas.
      </p>
    )
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <div className="w-40 shrink-0 truncate text-right text-[12px] text-muted-foreground">
            {r.label}
          </div>
          <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded bg-red-400/80"
              style={{ width: `${Math.max(4, Math.round((r.count / max) * 100))}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-[12px] font-medium text-foreground">{r.count}</span>
        </div>
      ))}
    </div>
  )
}

export default async function CrmDashboardPage({
  searchParams,
}: {
  searchParams: { agent?: string; range?: string }
}) {
  const currentUser = await requireAuth()
  const isAdmin = currentUser.role === 'ADMIN'
  const isAgente = currentUser.role === 'AGENTE'
  const isMarketing = currentUser.role === 'MARKETING'
  if (!isAdmin && !isAgente && !isMarketing) redirect('/dashboard?error=forbidden')

  // El agente solo ve lo suyo; admin/marketing pueden filtrar.
  const filter = {
    agentId: isAgente ? currentUser.id : (searchParams.agent ?? null),
  }

  const range = resolveRange(searchParams.range)

  const [crm, flow, funnels, agents] = await Promise.all([
    getCrmKpis(db, filter),
    getFlowKpis(db, filter, range),
    getDireccionKpis(db, filter),
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
            Analytics · CRM
          </div>
          <h1 className="mt-0.5 text-[20px] font-bold tracking-tight text-foreground">
            Dashboard CRM
          </h1>
        </div>
        {isAdmin && <DashboardFilters agents={agents} currentAgentId={filter.agentId} />}
      </header>

      <div className="space-y-8 px-4 pb-16 pt-6 md:px-8">
        {/* Salud CRM */}
        <section>
          <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Salud del CRM
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label={`Leads nuevos (${flow.range.label.toLowerCase()})`}
              value={String(flow.newBuyers.current + flow.newSellers.current)}
              deltaPct={
                flow.newBuyers.previous + flow.newSellers.previous > 0
                  ? Math.round(
                      ((flow.newBuyers.current +
                        flow.newSellers.current -
                        flow.newBuyers.previous -
                        flow.newSellers.previous) /
                        (flow.newBuyers.previous + flow.newSellers.previous)) *
                        100
                    )
                  : null
              }
              sub={`${flow.newBuyers.current} compra · ${flow.newSellers.current} venta`}
              tooltip="Compradores + vendedores creados en el periodo seleccionado, comparados con el periodo anterior de igual duración."
            />
            <KpiCard
              label="Leads sin dueño"
              value={String(crm.leadsWithoutOwner)}
              higherIsBetter={false}
              semaphore={crm.leadsWithoutOwner === 0 ? 'green' : 'red'}
              tooltip="Leads activos sin agente asignado. Debe tender a 0: si nadie es dueño, nadie actúa."
            />
            <KpiCard
              label="Sin próxima acción"
              value={String(crm.leadsWithoutNextAction)}
              higherIsBetter={false}
              semaphore={sem.leadsWithoutAction(crm.leadsWithoutNextAction)}
              tooltip="Leads activos sin tarea/seguimiento programado. 0 = verde, 1-5 ámbar, >5 rojo."
            />
            <KpiCard
              label="Tareas vencidas"
              value={String(crm.overdueTasks)}
              higherIsBetter={false}
              semaphore={crm.overdueTasks === 0 ? 'green' : crm.overdueTasks <= 5 ? 'amber' : 'red'}
              tooltip="Próximas acciones cuya fecha ya pasó. Anticipan pérdida de oportunidades."
            />
            <KpiCard
              label="Compradores activos"
              value={String(funnels.activeBuyers)}
              href="/compradores"
              tooltip="Compradores en estados activos."
            />
          </div>
        </section>

        {/* Funnels */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">Funnel comprador</h2>
            <FunnelChart stages={funnels.buyerFunnel} />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">Funnel vendedor</h2>
            <FunnelChart stages={funnels.vehicleFunnel} />
          </div>
        </section>

        {/* Motivos de pérdida */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">
              Motivos de pérdida · comprador
            </h2>
            <LostBars rows={crm.lostBuyers} />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">
              Motivos de pérdida · vendedor
            </h2>
            <LostBars rows={crm.lostSellers} />
          </div>
        </section>

        {/* Tablas accionables */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">
              Leads activos sin próxima acción
            </h2>
            <ActionableTable
              columns={[
                { key: 'name', label: 'Lead' },
                { key: 'kind', label: 'Tipo' },
                { key: 'detail', label: 'Estado' },
              ]}
              rows={crm.withoutActionRows.map((r) => ({
                id: r.id,
                href: r.href,
                semaphore: 'amber',
                cells: { name: r.name, kind: r.kind, detail: r.detail },
              }))}
              emptyText="Todos los leads activos tienen próxima acción. 👌"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">Tareas vencidas</h2>
            <ActionableTable
              columns={[
                { key: 'name', label: 'Lead' },
                { key: 'kind', label: 'Tipo' },
                { key: 'detail', label: 'Acción vencida' },
              ]}
              rows={crm.overdueRows.map((r) => ({
                id: r.id,
                href: r.href,
                semaphore: 'red',
                cells: { name: r.name, kind: r.kind, detail: r.detail },
              }))}
              emptyText="Sin tareas vencidas. Al día. 👌"
            />
          </div>
        </section>

        <p className="text-[11px] text-muted-foreground">
          Actualizado en tiempo real · datos calculados server-side.
        </p>
      </div>
    </div>
  )
}
