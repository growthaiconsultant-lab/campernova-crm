import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireCanViewTaller } from '@/lib/auth'
import { Button } from '@/components/ui/button'
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
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">
              {wo.vehicle.brand} {wo.vehicle.model}{' '}
              <span className="text-cn-ink-400 font-normal">{wo.vehicle.year}</span>
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[wo.status]}`}
            >
              {STATUS_LABELS[wo.status]}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Orden #{wo.id.slice(-8)} ·{' '}
            <Link href={`/vendedores/${wo.vehicle.sellerLead?.id}`} className="hover:underline">
              {wo.vehicle.sellerLead?.name}
            </Link>{' '}
            · {new Date(wo.createdAt).toLocaleDateString('es-ES')}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/taller">← Taller</Link>
        </Button>
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
                  <div className="rounded-lg border border-cn-line p-3">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                      <span className="text-cn-ink-500">
                        Horas previstas:{' '}
                        <span className="font-medium text-cn-ink-700">{plannedHours} h</span>
                      </span>
                      <span className="text-cn-ink-500">
                        Reales:{' '}
                        <span className="font-medium text-cn-ink-700">{totalRealHours} h</span>
                      </span>
                      {totalRealHours > 0 && hoursDeviation.deviation != null && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            hoursDeviation.status === 'desviado_arriba'
                              ? 'bg-red-100 text-red-700'
                              : hoursDeviation.status === 'por_debajo'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {hoursDeviation.deviation > 0 ? '+' : ''}
                          {hoursDeviation.deviation} h
                          {hoursDeviation.deviationPct != null
                            ? ` (${hoursDeviation.deviationPct > 0 ? '+' : ''}${Math.round(hoursDeviation.deviationPct)}%)`
                            : ''}
                          {hoursDeviation.status === 'desviado_arriba' ? ' · revisar' : ''}
                        </span>
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
                    <div className="overflow-hidden rounded-xl border border-cn-line">
                      <table className="w-full">
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
                  <div className="overflow-hidden rounded-xl border border-cn-line">
                    <table className="w-full text-sm">
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
