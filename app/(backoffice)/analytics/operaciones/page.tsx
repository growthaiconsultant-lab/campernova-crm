import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getOperacionesKpis } from '@/lib/kpi/operaciones'
import { KpiCard } from '@/components/analytics/kpi-card'
import { BarList } from '@/components/analytics/bar-list'
import { ActionableTable } from '@/components/analytics/actionable-table'
import { DashboardFilters } from '@/app/(backoffice)/dashboard/dashboard-filters'
import { STOCK_AGING_RED_DAYS } from '@/lib/kpi/thresholds'

export default async function OperacionesDashboardPage({
  searchParams,
}: {
  searchParams: { agent?: string }
}) {
  const currentUser = await requireAuth()
  const role = currentUser.role
  const canView = ['ADMIN', 'AGENTE', 'ENTREGAS', 'TALLER', 'MARKETING'].includes(role)
  if (!canView) redirect('/dashboard?error=forbidden')
  const isAdmin = role === 'ADMIN'

  const filter = { agentId: isAdmin ? (searchParams.agent ?? null) : null }

  const [op, agents] = await Promise.all([
    getOperacionesKpis(db, filter),
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
            Analytics · Operaciones
          </div>
          <h1 className="mt-0.5 text-[20px] font-bold tracking-tight text-foreground">
            Dashboard Operaciones
          </h1>
        </div>
        {isAdmin && <DashboardFilters agents={agents} currentAgentId={filter.agentId} />}
      </header>

      <div className="space-y-8 px-4 pb-16 pt-6 md:px-8">
        {/* Salud operativa */}
        <section>
          <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Salud operativa
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Stock activo"
              value={String(op.stockActive)}
              tooltip="Vehículos en NUEVO/TASADO/PUBLICADO/RESERVADO."
            />
            <KpiCard
              label="Bloqueados"
              value={String(op.blockedCount)}
              higherIsBetter={false}
              semaphore={op.blockedCount === 0 ? 'green' : op.blockedCount <= 3 ? 'amber' : 'red'}
              tooltip="Vehículos en TASADO/PUBLICADO con requisitos pendientes que impiden avanzar."
            />
            <KpiCard
              label={`Aging >${STOCK_AGING_RED_DAYS}d`}
              value={String(op.agingOver45)}
              higherIsBetter={false}
              semaphore={op.agingOver45 === 0 ? 'green' : 'red'}
              tooltip="Vehículos publicados más de 45 días sin vender. Riesgo de inventario o sobreprecio."
            />
            <KpiCard
              label="Trust pendiente"
              value={String(op.trustPending)}
              higherIsBetter={false}
              semaphore={op.trustPending === 0 ? 'green' : 'amber'}
              tooltip="Vehículos en preparación/publicados sin sello Trust Passport emitido."
            />
            <KpiCard
              label="Entregas próximas"
              value={String(op.upcomingDeliveries)}
              href="/entregas"
              tooltip="Entregas programadas o en curso."
            />
          </div>
        </section>

        {/* Distribución + bloqueos + aging */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">Vehículos por estado</h2>
            <BarList items={op.vehicleByStatus} />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">
              Bloqueados por motivo
            </h2>
            <BarList items={op.blockedByReason} color="#dc2626" emptyText="Nada bloqueado. 👌" />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">
              Aging de stock (publicado)
            </h2>
            <BarList items={op.agingBuckets} color="#d97706" />
          </div>
        </section>

        {/* Tablas accionables */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">Vehículos bloqueados</h2>
            <ActionableTable
              columns={[
                { key: 'name', label: 'Vehículo' },
                { key: 'detail', label: 'Motivo' },
              ]}
              rows={op.blockedRows.map((r) => ({
                id: r.id,
                href: r.href,
                semaphore: 'red',
                cells: { name: r.name, detail: r.detail },
              }))}
              emptyText="Ningún vehículo bloqueado. 👌"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">
              Trust Passport pendiente
            </h2>
            <ActionableTable
              columns={[
                { key: 'name', label: 'Vehículo' },
                { key: 'detail', label: 'Estado' },
              ]}
              rows={op.trustPendingRows.map((r) => ({
                id: r.id,
                href: r.href,
                semaphore: 'amber',
                cells: { name: r.name, detail: r.detail },
              }))}
              emptyText="Todo el stock verificado. 👌"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">Entregas próximas</h2>
            <ActionableTable
              columns={[
                { key: 'name', label: 'Vehículo' },
                { key: 'detail', label: 'Fecha' },
              ]}
              rows={op.deliveryRows.map((r) => ({
                id: r.id,
                href: r.href,
                cells: { name: r.name, detail: r.detail },
              }))}
              emptyText="Sin entregas próximas."
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
