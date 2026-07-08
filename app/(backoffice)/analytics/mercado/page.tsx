import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getMercadoKpis } from '@/lib/kpi/mercado'
import { KpiCard } from '@/components/analytics/kpi-card'
import { BarList } from '@/components/analytics/bar-list'
import { ActionableTable } from '@/components/analytics/actionable-table'
import { DashboardFilters } from '@/app/(backoffice)/dashboard/dashboard-filters'

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export default async function MercadoDashboardPage({
  searchParams,
}: {
  searchParams: { agent?: string }
}) {
  const currentUser = await requireAuth()
  const role = currentUser.role
  if (!['ADMIN', 'AGENTE', 'MARKETING'].includes(role)) redirect('/dashboard?error=forbidden')
  const isAdmin = role === 'ADMIN'

  const filter = { agentId: isAdmin ? (searchParams.agent ?? null) : null }

  const [mk, agents] = await Promise.all([
    getMercadoKpis(db, filter),
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
            Analytics · Inteligencia de Mercado
          </div>
          <h1 className="mt-0.5 text-[20px] font-bold tracking-tight text-foreground">
            Inteligencia de Mercado
          </h1>
        </div>
        {isAdmin && <DashboardFilters agents={agents} currentAgentId={filter.agentId} />}
      </header>

      <div className="space-y-8 px-4 pb-16 pt-6 md:px-8">
        <section>
          <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Señales de mercado
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label="Demanda activa"
              value={String(mk.activeDemand)}
              tooltip="Compradores activos estructurados."
            />
            <KpiCard
              label="Segmentos sin cubrir"
              value={String(mk.uncoveredSegments)}
              semaphore={mk.uncoveredSegments > 0 ? 'amber' : 'green'}
              tooltip="Segmentos con más demanda que stock disponible: oportunidad de captación."
            />
            <KpiCard
              label="Ventas cerradas"
              value={String(mk.closedSales)}
              tooltip="Operaciones cerradas como venta (ofertas convertidas)."
            />
            <KpiCard
              label="Precio medio de cierre"
              value={mk.avgClosePrice != null ? EUR(mk.avgClosePrice) : '—'}
              tooltip="Importe medio de las operaciones cerradas. Alimenta la valoración."
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">Demanda por tipo</h2>
            <BarList items={mk.demandByType} emptyText="Sin demanda tipificada." />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">
              Demanda por rango de precio
            </h2>
            <BarList
              items={mk.demandByPrice}
              color="#7c3aed"
              emptyText="Sin presupuestos registrados."
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-1 text-[14px] font-semibold text-foreground">
              Gap oferta / demanda por segmento
            </h2>
            <p className="mb-4 text-[12px] text-muted-foreground">
              Gap positivo = más compradores que stock → captar vehículos así.
            </p>
            <ActionableTable
              columns={[
                { key: 'name', label: 'Segmento' },
                { key: 'detail', label: 'Demanda vs stock' },
              ]}
              rows={mk.gapRows.map((r) => ({
                id: r.id,
                href: r.href,
                cells: { name: r.name, detail: r.detail },
              }))}
              emptyText="Sin datos de segmento."
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">
              Rotación por modelo (días de venta)
            </h2>
            <ActionableTable
              columns={[
                { key: 'name', label: 'Modelo' },
                { key: 'detail', label: 'Rotación' },
              ]}
              rows={mk.rotationRows.map((r) => ({
                id: r.id,
                href: r.href,
                cells: { name: r.name, detail: r.detail },
              }))}
              emptyText="Aún sin ventas para calcular rotación por modelo."
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
