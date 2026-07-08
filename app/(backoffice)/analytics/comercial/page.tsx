import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getComercialKpis } from '@/lib/kpi/comercial'
import { KpiCard } from '@/components/analytics/kpi-card'
import { ActionableTable } from '@/components/analytics/actionable-table'
import { DashboardFilters } from '@/app/(backoffice)/dashboard/dashboard-filters'

export default async function ComercialDashboardPage({
  searchParams,
}: {
  searchParams: { agent?: string }
}) {
  const currentUser = await requireAuth()
  const role = currentUser.role
  if (!['ADMIN', 'AGENTE', 'MARKETING'].includes(role)) redirect('/dashboard?error=forbidden')
  const isAdmin = role === 'ADMIN'
  const isAgente = role === 'AGENTE'

  // Por defecto el comercial ve lo suyo; el admin ve todo o filtra.
  const agentId = isAgente ? currentUser.id : (searchParams.agent ?? null)

  const [k, agents] = await Promise.all([
    getComercialKpis(db, agentId),
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
            Analytics · Comercial
          </div>
          <h1 className="mt-0.5 text-[20px] font-bold tracking-tight text-foreground">
            Mi día comercial
          </h1>
        </div>
        {isAdmin && <DashboardFilters agents={agents} currentAgentId={agentId} />}
      </header>

      <div className="space-y-8 px-4 pb-16 pt-6 md:px-8">
        <section>
          <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Mi día
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Tareas hoy"
              value={String(k.tasksToday)}
              tooltip="Próximas acciones con vencimiento hoy."
            />
            <KpiCard
              label="Tareas vencidas"
              value={String(k.overdueTasks)}
              higherIsBetter={false}
              semaphore={k.overdueTasks === 0 ? 'green' : k.overdueTasks <= 5 ? 'amber' : 'red'}
              tooltip="Próximas acciones cuya fecha ya pasó."
            />
            <KpiCard
              label="Citas hoy"
              value={String(k.appointmentsToday)}
              href="/calendario"
              tooltip="Citas programadas para hoy."
            />
            <KpiCard
              label="Compradores calientes"
              value={String(k.hotBuyers)}
              semaphore={k.hotBuyers > 0 ? 'amber' : 'gray'}
              tooltip="Compradores activos marcados como calientes (HOT)."
            />
            <KpiCard
              label="Reservas activas"
              value={String(k.activeReservations)}
              href="/ofertas"
              tooltip="Reservas vivas (ofertas aceptadas con señal)."
            />
          </div>
        </section>

        {/* Lista priorizada */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 text-[14px] font-semibold text-foreground">Mi lista priorizada</h2>
          <p className="mb-4 text-[12px] text-muted-foreground">
            Reservas en riesgo → tareas vencidas → compradores calientes.
          </p>
          <ActionableTable
            columns={[
              { key: 'name', label: 'Entidad' },
              { key: 'reason', label: 'Motivo de prioridad' },
            ]}
            rows={k.priorityRows.map((r) => ({
              id: r.id,
              href: r.href,
              semaphore: r.priority,
              cells: { name: r.name, reason: r.reason },
            }))}
            emptyText="Nada urgente ahora mismo. 👌"
          />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">Reservas en riesgo</h2>
            <ActionableTable
              columns={[
                { key: 'name', label: 'Reserva' },
                { key: 'reason', label: 'Estado' },
              ]}
              rows={k.reservationRows.map((r) => ({
                id: r.id,
                href: r.href,
                semaphore: r.priority,
                cells: { name: r.name, reason: r.reason },
              }))}
              emptyText="Ninguna reserva en riesgo. 👌"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">
              Compradores calientes
            </h2>
            <ActionableTable
              columns={[
                { key: 'name', label: 'Comprador' },
                { key: 'reason', label: 'Detalle' },
              ]}
              rows={k.hotRows.map((r) => ({
                id: r.id,
                href: r.href,
                semaphore: 'amber',
                cells: { name: r.name, reason: r.reason },
              }))}
              emptyText="Sin compradores calientes ahora mismo."
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
