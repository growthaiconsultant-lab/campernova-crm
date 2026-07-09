import Link from 'next/link'
import { Plus, CalendarDays, Wrench } from 'lucide-react'
import { db } from '@/lib/db'
import { requireCanViewTaller } from '@/lib/auth'
import { computeHoursDeviation } from '@/lib/taller/scheduling'
import {
  Eyebrow,
  Card,
  ActionableTable,
  HexPill,
  ButtonLink,
  EmptyState,
  type Column,
} from '@/components/redesign'
import { cn } from '@/lib/utils'
import type { WorkOrderStatus, WorkOrderApprovalLevel } from '@prisma/client'

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_DIAGNOSTICO: 'En diagnóstico',
  PRESUPUESTADA: 'Presupuestada',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  RECHAZADA: 'Rechazada',
}

// Semáforo del handoff: en curso = marca, pendiente = gris, presupuestada =
// azul info, diagnóstico = ámbar, completada = verde, rechazada = rojo.
const STATUS_HEX: Record<WorkOrderStatus, string> = {
  PENDIENTE: '#8b94a3',
  EN_DIAGNOSTICO: '#c9820a',
  PRESUPUESTADA: '#3a6fd4',
  EN_CURSO: '#0e7d6b',
  COMPLETADA: '#1a9d5f',
  RECHAZADA: '#d64545',
}

const APPROVAL_LABELS: Record<WorkOrderApprovalLevel, string> = {
  NO_REQUIERE: '—',
  REQUIERE_CEO: 'Pendiente CEO',
  APROBADA_CEO: 'Aprobada',
  RECHAZADA_CEO: 'Rechazada CEO',
}

const APPROVAL_HEX: Record<WorkOrderApprovalLevel, string | null> = {
  NO_REQUIERE: null,
  REQUIERE_CEO: '#c9820a',
  APROBADA_CEO: '#1a9d5f',
  RECHAZADA_CEO: '#d64545',
}

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const fmtH = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export default async function TallerPage({
  searchParams,
}: {
  searchParams: { status?: string; assigned?: string }
}) {
  await requireCanViewTaller()

  const where: Record<string, unknown> = {}
  if (searchParams.status) where.status = searchParams.status
  if (searchParams.assigned) where.assignedToId = searchParams.assigned

  const [workOrders, users] = await Promise.all([
    db.workOrder.findMany({
      where,
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
        timeEntries: { select: { hours: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const activeCount = workOrders.filter(
    (wo) => wo.status !== 'COMPLETADA' && wo.status !== 'RECHAZADA'
  ).length
  const pendingCeo = workOrders.filter((wo) => wo.approvalLevel === 'REQUIERE_CEO').length
  const enCurso = workOrders.filter((wo) => wo.status === 'EN_CURSO').length

  type Row = (typeof workOrders)[number]

  const columns: Column<Row>[] = [
    {
      key: 'vehicle',
      header: 'Vehículo / Orden',
      cell: (wo) => (
        <div>
          <div className="text-ink">
            {wo.vehicle.brand} {wo.vehicle.model}
          </div>
          <div className="mt-0.5 max-w-[240px] truncate text-[11px] font-medium text-ink3">
            {wo.description}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (wo) => <HexPill hex={STATUS_HEX[wo.status]}>{STATUS_LABELS[wo.status]}</HexPill>,
    },
    {
      key: 'approval',
      header: 'Aprob.',
      cell: (wo) => {
        const hex = APPROVAL_HEX[wo.approvalLevel]
        return hex ? (
          <HexPill hex={hex}>{APPROVAL_LABELS[wo.approvalLevel]}</HexPill>
        ) : (
          <span className="text-ink3">—</span>
        )
      },
    },
    {
      key: 'hours',
      header: 'Horas P→R',
      align: 'center',
      cell: (wo) => {
        const real = wo.timeEntries.reduce((s, t) => s + Number(t.hours), 0)
        const planned = wo.estimatedHours ? Number(wo.estimatedHours) : null
        const dev = computeHoursDeviation(planned, real)
        if (dev.planned == null && dev.real === 0)
          return <span className="font-mono text-[11.5px] font-semibold text-ink3">— → —</span>
        const color =
          dev.status === 'desviado_arriba'
            ? 'text-bad'
            : dev.status === 'dentro' || dev.status === 'por_debajo'
              ? dev.real > 0
                ? 'text-good'
                : 'text-ink3'
              : 'text-ink3'
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('font-mono text-[11.5px] font-semibold', color)}>
              {dev.planned != null ? fmtH(dev.planned) : '—'} →{' '}
              {dev.real > 0 ? fmtH(dev.real) : '—'}
            </span>
            {dev.status === 'desviado_arriba' && dev.deviationPct != null && (
              <span className="rounded-[5px] bg-bad-tint px-1.5 py-0.5 font-hanken text-[9px] font-semibold text-bad">
                +{Math.round(dev.deviationPct)}%
              </span>
            )}
          </span>
        )
      },
    },
    {
      key: 'cost',
      header: 'Coste est.',
      mono: true,
      align: 'right',
      cell: (wo) =>
        wo.estimatedCost ? EUR(Number(wo.estimatedCost)) : <span className="text-ink3">—</span>,
    },
    {
      key: 'mechanic',
      header: 'Mecánico',
      cell: (wo) => (
        <span className="font-medium text-ink2">{wo.assignedTo?.name ?? 'Sin asignar'}</span>
      ),
    },
    {
      key: 'delivery',
      header: 'Entrega',
      mono: true,
      cell: (wo) =>
        wo.scheduledEnd ? (
          <span className="text-ink2">
            {new Date(wo.scheduledEnd).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
              timeZone: 'Europe/Madrid',
            })}
          </span>
        ) : (
          <span className="text-ink3">—</span>
        ),
    },
  ]

  const statuses = Object.keys(STATUS_LABELS) as WorkOrderStatus[]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>CRM · Operaciones</Eyebrow>
          <h1 className="mt-1 font-hanken text-[23px] font-bold tracking-[-0.02em] text-ink">
            Taller
          </h1>
          <p className="mt-1 font-hanken text-[13.5px] text-ink2">
            <b className="text-ink">{activeCount}</b> orden{activeCount === 1 ? '' : 'es'} activa
            {activeCount === 1 ? '' : 's'}
            {pendingCeo > 0 && (
              <>
                {' '}
                ·{' '}
                <b className="text-warn">
                  {pendingCeo} pendiente{pendingCeo === 1 ? '' : 's'} de CEO
                </b>
              </>
            )}
            {enCurso > 0 && <> · En curso {enCurso}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href="/taller/agenda" variant="secondary">
            <CalendarDays size={15} strokeWidth={1.9} className="mr-1.5" />
            Agenda
          </ButtonLink>
          <ButtonLink href="/taller/nueva" variant="primary">
            <Plus size={15} strokeWidth={2.2} className="mr-1.5" />
            Nueva orden
          </ButtonLink>
        </div>
      </div>

      {/* Filtros */}
      <form className="mb-4 flex flex-wrap gap-2">
        <select
          name="status"
          defaultValue={searchParams.status ?? ''}
          className="h-9 rounded-[10px] border border-line bg-card px-3 font-hanken text-[13px] text-ink outline-none focus:border-brand"
        >
          <option value="">Todos los estados</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          name="assigned"
          defaultValue={searchParams.assigned ?? ''}
          className="h-9 rounded-[10px] border border-line bg-card px-3 font-hanken text-[13px] text-ink outline-none focus:border-brand"
        >
          <option value="">Todos los mecánicos</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-[10px] bg-brand px-4 font-hanken text-[13px] font-semibold text-white transition-colors hover:bg-brand2"
        >
          Filtrar
        </button>
        {(searchParams.status || searchParams.assigned) && (
          <Link
            href="/taller"
            className="inline-flex h-9 items-center rounded-[10px] border border-line px-3 font-hanken text-[13px] text-ink2 hover:bg-canvas"
          >
            Limpiar
          </Link>
        )}
      </form>

      <Card pad={false}>
        <ActionableTable
          columns={columns}
          rows={workOrders}
          rowKey={(wo) => wo.id}
          rowHref={(wo) => `/taller/${wo.id}`}
          empty={
            <EmptyState
              icon={<Wrench size={20} strokeWidth={1.9} />}
              title="Sin órdenes de trabajo"
              description="Aquí verás las órdenes del taller con su estado, aprobación CEO, horas previstas vs reales y coste estimado."
              cta={{ label: 'Nueva orden', href: '/taller/nueva' }}
            />
          }
        />
      </Card>
    </div>
  )
}
