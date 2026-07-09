import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireCanViewTaller } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import type {
  WorkOrderStatus,
  WorkOrderApprovalLevel,
  ChecklistItemCategory,
  ChecklistItemResult,
} from '@prisma/client'
import { WorkOrderTabs, TabPanel } from './work-order-tabs'
import { WorkOrderActionsBar } from './work-order-actions-bar'
import { ChecklistItemRow } from './checklist-item-row'
import { TimeEntrySection } from './time-entry-form'
import { PartsSection } from './parts-section'
import { ScheduleCard } from './schedule-card'
import { computeHoursDeviation } from '@/lib/taller/scheduling'

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_DIAGNOSTICO: 'En diagnóstico',
  PRESUPUESTADA: 'Presupuestada',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  RECHAZADA: 'Rechazada',
}

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  PENDIENTE: 'bg-gray-100 text-gray-700',
  EN_DIAGNOSTICO: 'bg-blue-100 text-blue-700',
  PRESUPUESTADA: 'bg-yellow-100 text-yellow-700',
  EN_CURSO: 'bg-teal-100 text-teal-700',
  COMPLETADA: 'bg-green-100 text-green-700',
  RECHAZADA: 'bg-red-100 text-red-700',
}

const APPROVAL_LABELS: Record<WorkOrderApprovalLevel, string> = {
  NO_REQUIERE: 'Sin requerir aprobación',
  REQUIERE_CEO: 'Pendiente aprobación CEO',
  APROBADA_CEO: 'Aprobada por CEO',
  RECHAZADA_CEO: 'Rechazada por CEO',
}

const CATEGORY_LABELS: Record<ChecklistItemCategory, string> = {
  MECANICA: 'Mecánica',
  CAMPER: 'Camper',
  ELECTRICIDAD: 'Electricidad',
}

export default async function WorkOrderPage({ params }: { params: { id: string } }) {
  const currentUser = await requireCanViewTaller()

  const [wo, users] = await Promise.all([
    db.workOrder.findUnique({
      where: { id: params.id },
      include: {
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            sellerLead: { select: { id: true, name: true } },
          },
        },
        assignedTo: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        checklist: { orderBy: [{ category: 'asc' }, { item: 'asc' }] },
        timeEntries: {
          include: { worker: { select: { id: true, name: true } } },
          orderBy: { workDate: 'desc' },
        },
        parts: { orderBy: { createdAt: 'asc' } },
        costs: {
          include: { createdBy: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!wo) notFound()

  const isAdmin = currentUser.role === 'ADMIN'
  const isClosed = wo.status === 'COMPLETADA' || wo.status === 'RECHAZADA'

  const checklistByCategory = wo.checklist.reduce(
    (acc, item) => {
      const cat = item.category as ChecklistItemCategory
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(item)
      return acc
    },
    {} as Record<ChecklistItemCategory, typeof wo.checklist>
  )

  const timeEntries = wo.timeEntries.map((e) => ({
    id: e.id,
    description: e.description,
    hours: Number(e.hours),
    hourlyRate: Number(e.hourlyRate),
    workDate: e.workDate,
    workerName: e.worker?.name ?? null,
    workerId: e.workerId,
  }))

  const parts = wo.parts.map((p) => ({
    id: p.id,
    name: p.name,
    quantity: p.quantity,
    unitCost: Number(p.unitCost),
    supplier: p.supplier,
    invoiceUrl: p.invoiceUrl,
  }))

  const totalHoursCost = timeEntries.reduce((s, e) => s + e.hours * e.hourlyRate, 0)
  const totalPartsCost = parts.reduce((s, p) => s + p.quantity * p.unitCost, 0)
  const totalRealCost = totalHoursCost + totalPartsCost

  const totalRealHours = timeEntries.reduce((s, e) => s + e.hours, 0)
  const plannedHours = wo.estimatedHours ? Number(wo.estimatedHours) : null
  const hoursDeviation = computeHoursDeviation(plannedHours, totalRealHours)

  return (
    <div className="space-y-6">
      {/* Breadcrumb (mockup TAL2: módulo / Orden #OT-XXXX) */}
      <nav className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink2">
        <Link
          href="/taller"
          className="inline-flex items-center gap-1 transition-colors hover:text-ink"
        >
          <span aria-hidden>‹</span> Taller
        </Link>
        <span className="text-ink3">/</span>
        <span className="normal-case tracking-normal text-ink3">
          Orden #{wo.id.slice(-8).toUpperCase()}
        </span>
      </nav>

      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-hanken text-[21px] font-bold leading-[1.1] tracking-[-0.01em] text-ink">
              {wo.vehicle.brand} {wo.vehicle.model}{' '}
              <span className="font-normal text-ink3">{wo.vehicle.year}</span>
            </h1>
            <span
              className={`inline-flex items-center rounded-[6px] px-2 py-[3px] text-[10.5px] font-semibold ${STATUS_COLORS[wo.status]}`}
            >
              {STATUS_LABELS[wo.status]}
            </span>
            <span
              className={`inline-flex items-center rounded-[6px] px-2 py-[3px] text-[10.5px] font-semibold ${
                wo.kind === 'MEJORA' ? 'bg-violet-100 text-violet-700' : 'bg-track text-ink2'
              }`}
            >
              {wo.kind === 'MEJORA' ? 'Mejora' : 'Reparación'}
            </span>
          </div>
          <p className="mt-1 font-hanken text-[13px] text-ink2">
            <Link
              href={`/vendedores/${wo.vehicle.sellerLead?.id}`}
              className="font-medium hover:text-brand2"
            >
              {wo.vehicle.sellerLead?.name}
            </Link>{' '}
            · creada {new Date(wo.createdAt).toLocaleDateString('es-ES')}
          </p>
        </div>
        {wo.estimatedCost && (
          <div className="shrink-0 text-right">
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink3">
              Coste est.
            </div>
            <div className="font-hanken text-[22px] font-bold tracking-[-0.02em] text-ink">
              {Number(wo.estimatedCost).toLocaleString('es-ES', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
        )}
      </div>

      {/* Acciones de estado */}
      <WorkOrderActionsBar
        woId={wo.id}
        status={wo.status}
        approvalLevel={wo.approvalLevel}
        isAdmin={isAdmin}
      />

      {/* Planificación / agenda */}
      <ScheduleCard
        woId={wo.id}
        users={users}
        assignedToId={wo.assignedToId}
        assignedToName={wo.assignedTo?.name ?? null}
        estimatedHours={plannedHours}
        scheduledStart={wo.scheduledStart ? wo.scheduledStart.toISOString() : null}
        scheduledEnd={wo.scheduledEnd ? wo.scheduledEnd.toISOString() : null}
        isClosed={isClosed}
      />

      {/* Tabs */}
      <Card>
        <CardContent className="pb-6 pt-0">
          <WorkOrderTabs>
            {/* ── RESUMEN ── */}
            <TabPanel tab="resumen">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-cn-ink-500">Estado aprobación</p>
                    <p className="mt-0.5 text-sm font-medium text-cn-ink-700">
                      {APPROVAL_LABELS[wo.approvalLevel]}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-cn-ink-500">Asignado a</p>
                    <p className="mt-0.5 text-sm font-medium text-cn-ink-700">
                      {wo.assignedTo?.name ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-cn-ink-500">Coste estimado</p>
                    <p className="mt-0.5 text-sm font-medium text-cn-ink-700">
                      {wo.estimatedCost
                        ? Number(wo.estimatedCost).toLocaleString('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                          })
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-cn-ink-500">Coste real</p>
                    <p className="mt-0.5 text-sm font-bold text-cn-teal-900">
                      {totalRealCost.toLocaleString('es-ES', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </p>
                  </div>
                  {wo.startedAt && (
                    <div>
                      <p className="text-xs text-cn-ink-500">Inicio</p>
                      <p className="mt-0.5 text-sm">
                        {new Date(wo.startedAt).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  )}
                  {wo.completedAt && (
                    <div>
                      <p className="text-xs text-cn-ink-500">Completada</p>
                      <p className="mt-0.5 text-sm">
                        {new Date(wo.completedAt).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  )}
                  {wo.approvedBy && (
                    <div>
                      <p className="text-xs text-cn-ink-500">Aprobado por</p>
                      <p className="mt-0.5 text-sm">{wo.approvedBy.name}</p>
                    </div>
                  )}
                  {wo.approvalLimit && (
                    <div>
                      <p className="text-xs text-cn-ink-500">Límite aprobación</p>
                      <p className="mt-0.5 text-sm">
                        {Number(wo.approvalLimit).toLocaleString('es-ES', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {plannedHours != null && (
                  /* Bloque grande Horas P→R (mockup TAL2): PREVISTAS → REALES + DESVIACIÓN */
                  <div className="rounded-[14px] border border-line bg-card p-4">
                    <div className="flex flex-wrap items-end gap-6">
                      <div>
                        <div className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-ink3">
                          Previstas
                        </div>
                        <div className="mt-1 font-hanken text-[26px] font-bold leading-none text-ink2">
                          {plannedHours} h
                        </div>
                      </div>
                      <span className="pb-1 text-[20px] leading-none text-ink3" aria-hidden>
                        →
                      </span>
                      <div>
                        <div
                          className={`font-mono text-[10px] font-medium uppercase tracking-[0.06em] ${
                            hoursDeviation.status === 'desviado_arriba' ? 'text-bad' : 'text-ink3'
                          }`}
                        >
                          Reales
                        </div>
                        <div
                          className={`mt-1 font-hanken text-[26px] font-bold leading-none ${
                            hoursDeviation.status === 'desviado_arriba'
                              ? 'text-bad'
                              : totalRealHours > 0
                                ? 'text-good'
                                : 'text-ink3'
                          }`}
                        >
                          {totalRealHours} h
                        </div>
                      </div>
                      {totalRealHours > 0 && hoursDeviation.deviation != null && (
                        <div className="ml-auto text-right">
                          <div className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-ink3">
                            Desviación
                          </div>
                          <div
                            className={`mt-1 font-hanken text-[18px] font-bold leading-none ${
                              hoursDeviation.status === 'desviado_arriba'
                                ? 'text-bad'
                                : hoursDeviation.status === 'por_debajo'
                                  ? 'text-info'
                                  : 'text-good'
                            }`}
                          >
                            {hoursDeviation.deviation > 0 ? '+' : ''}
                            {hoursDeviation.deviation} h
                            {hoursDeviation.deviationPct != null
                              ? ` · ${hoursDeviation.deviationPct > 0 ? '+' : ''}${Math.round(hoursDeviation.deviationPct)}%`
                              : ''}
                          </div>
                          {hoursDeviation.status === 'desviado_arriba' && (
                            <div className="mt-0.5 font-hanken text-[11px] font-semibold text-bad">
                              revisar imputaciones
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {wo.description && (
                  <div>
                    <p className="text-cn-ink-400 mb-1 text-xs font-medium uppercase tracking-wide">
                      Descripción
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-cn-ink-700">{wo.description}</p>
                  </div>
                )}

                {wo.notes && (
                  <div>
                    <p className="text-cn-ink-400 mb-1 text-xs font-medium uppercase tracking-wide">
                      Notas internas
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-cn-ink-500">{wo.notes}</p>
                  </div>
                )}

                {wo.checklist.length > 0 &&
                  (() => {
                    const okCount = wo.checklist.filter((c) => c.result === 'OK').length
                    const pct = Math.round((okCount / wo.checklist.length) * 100)
                    return (
                      <div>
                        <p className="text-cn-ink-400 mb-1 text-xs font-medium uppercase tracking-wide">
                          Checklist — {okCount}/{wo.checklist.length} ítems OK ({pct}%)
                        </p>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-cn-line">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })()}
              </div>
            </TabPanel>

            {/* ── CHECKLIST ── */}
            <TabPanel tab="checklist">
              <div className="space-y-6">
                {(Object.keys(checklistByCategory) as ChecklistItemCategory[]).map((cat) => (
                  <div key={cat}>
                    <p className="text-cn-ink-400 mb-2 text-xs font-semibold uppercase tracking-wide">
                      {CATEGORY_LABELS[cat]}
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-cn-line">
                      <table className="w-full min-w-[480px]">
                        <tbody>
                          {checklistByCategory[cat].map((item) => (
                            <ChecklistItemRow
                              key={item.id}
                              id={item.id}
                              item={item.item}
                              result={item.result as ChecklistItemResult}
                              notes={item.notes}
                              isClosed={isClosed}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </TabPanel>

            {/* ── HORAS ── */}
            <TabPanel tab="horas">
              <TimeEntrySection
                woId={wo.id}
                entries={timeEntries}
                currentUserId={currentUser.id}
                isAdmin={isAdmin}
                isClosed={isClosed}
              />
            </TabPanel>

            {/* ── PIEZAS ── */}
            <TabPanel tab="piezas">
              <PartsSection woId={wo.id} parts={parts} isAdmin={isAdmin} isClosed={isClosed} />
            </TabPanel>

            {/* ── COSTES RESULTANTES ── */}
            <TabPanel tab="costes">
              <div className="space-y-3">
                {wo.costs.length === 0 ? (
                  <p className="text-cn-ink-400 py-6 text-center text-sm">
                    {isClosed
                      ? 'Esta orden no generó costes imputados.'
                      : 'Los costes se generan automáticamente al completar la orden.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-cn-line">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="border-b border-cn-line bg-cn-cream-50">
                          <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">
                            Categoría
                          </th>
                          <th className="px-4 py-2.5 text-left font-medium text-cn-ink-500">
                            Descripción
                          </th>
                          <th className="px-4 py-2.5 text-right font-medium text-cn-ink-500">
                            Importe
                          </th>
                          <th className="hidden px-4 py-2.5 text-left font-medium text-cn-ink-500 sm:table-cell">
                            Creado por
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {wo.costs.map((cost) => (
                          <tr key={cost.id} className="border-b border-cn-line last:border-0">
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center rounded-full bg-cn-line px-2 py-0.5 text-xs font-medium text-cn-ink-700">
                                {cost.category === 'MANO_OBRA_TALLER' ? 'Mano obra' : 'Piezas'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-cn-ink-700">{cost.description}</td>
                            <td className="px-4 py-3 text-right font-medium text-cn-teal-900">
                              {Number(cost.amount).toLocaleString('es-ES', {
                                style: 'currency',
                                currency: 'EUR',
                              })}
                            </td>
                            <td className="hidden px-4 py-3 text-cn-ink-500 sm:table-cell">
                              {cost.createdBy?.name ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabPanel>
          </WorkOrderTabs>
        </CardContent>
      </Card>
    </div>
  )
}
