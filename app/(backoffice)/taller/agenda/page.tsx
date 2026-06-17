import Link from 'next/link'
import { db } from '@/lib/db'
import { requireCanViewTaller } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { List } from 'lucide-react'
import { addWorkingDays, DEFAULT_HOURS_PER_DAY } from '@/lib/taller/scheduling'
import type { WorkOrderStatus } from '@prisma/client'

const ACTIVE_STATUSES: WorkOrderStatus[] = [
  'PENDIENTE',
  'EN_DIAGNOSTICO',
  'PRESUPUESTADA',
  'EN_CURSO',
]

// Color del bloque según estado de la orden (coherente con el resto del taller).
const BLOCK_STYLE: Record<string, string> = {
  PENDIENTE: 'bg-gray-100 text-gray-700',
  EN_DIAGNOSTICO: 'bg-blue-100 text-blue-700',
  PRESUPUESTADA: 'bg-yellow-100 text-yellow-700',
  EN_CURSO: 'bg-teal-100 text-teal-700',
}

const DAY_LABELS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Lunes de la semana de `d`, desplazado `offsetWeeks`. */
function mondayOf(d: Date, offsetWeeks = 0): Date {
  const x = startOfDay(d)
  const day = x.getDay() // 0=dom … 6=sáb
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff + offsetWeeks * 7)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Diferencia en días de calendario (solo fecha). */
function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000)
}

const fmtDay = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

export default async function TallerAgendaPage({
  searchParams,
}: {
  searchParams: { week?: string }
}) {
  await requireCanViewTaller()

  const offset = Number.parseInt(searchParams.week ?? '0', 10) || 0
  const now = new Date()
  const monday = mondayOf(now, offset)
  const days = Array.from({ length: 6 }, (_, i) => addDays(monday, i)) // lun–sáb
  const weekStart = monday
  const weekEnd = addDays(monday, 6) // hasta el domingo (exclusivo a efectos de solape)
  const todayKey = startOfDay(now).getTime()

  // Órdenes activas (para backlog) + las que solapan con la semana visible (para la rejilla).
  const activeOrders = await db.workOrder.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    select: {
      id: true,
      status: true,
      description: true,
      estimatedHours: true,
      scheduledStart: true,
      scheduledEnd: true,
      assignedToId: true,
      assignedTo: { select: { id: true, name: true } },
      vehicle: { select: { brand: true, model: true, year: true } },
    },
  })

  // Backlog (horas en cola) por mecánico → fecha "libre desde".
  const backlogByMechanic = new Map<string, number>()
  for (const o of activeOrders) {
    if (!o.assignedToId) continue
    const h = o.estimatedHours ? Number(o.estimatedHours) : 0
    backlogByMechanic.set(o.assignedToId, (backlogByMechanic.get(o.assignedToId) ?? 0) + h)
  }

  // Filas = mecánicos con alguna orden activa asignada (los que tienen carga).
  const mechanics = new Map<string, { id: string; name: string }>()
  for (const o of activeOrders) {
    if (o.assignedTo)
      mechanics.set(o.assignedTo.id, { id: o.assignedTo.id, name: o.assignedTo.name })
  }
  const mechanicRows = Array.from(mechanics.values()).sort((a, b) => a.name.localeCompare(b.name))

  // Bloques que solapan la semana visible (con responsable y planificación).
  type Block = {
    id: string
    status: WorkOrderStatus
    label: string
    sub: string
    startCol: number
    span: number
  }
  const blocksByMechanic = new Map<string, Block[]>()
  let scheduledCount = 0
  for (const o of activeOrders) {
    if (!o.assignedToId || !o.scheduledStart || !o.scheduledEnd) continue
    if (o.scheduledStart >= weekEnd || o.scheduledEnd < weekStart) continue
    scheduledCount++
    const s = Math.max(0, dayDiff(monday, o.scheduledStart))
    const e = Math.min(5, dayDiff(monday, o.scheduledEnd))
    if (e < 0 || s > 5) continue
    const startCol = Math.max(0, s)
    const span = Math.max(1, Math.min(5, e) - startCol + 1)
    const list = blocksByMechanic.get(o.assignedToId) ?? []
    list.push({
      id: o.id,
      status: o.status,
      label: `${o.vehicle.brand} ${o.vehicle.model}`,
      sub: o.description,
      startCol,
      span,
    })
    blocksByMechanic.set(o.assignedToId, list)
  }

  function freeFromLabel(mechanicId: string): string {
    const backlog = backlogByMechanic.get(mechanicId) ?? 0
    const backlogDays = Math.ceil(backlog / DEFAULT_HOURS_PER_DAY)
    const free = addWorkingDays(now, backlogDays)
    return startOfDay(free).getTime() <= todayKey ? 'hoy' : fmtDay(free)
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda del taller</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Semana del {fmtDay(monday)} al {fmtDay(addDays(monday, 5))}
            {offset === 0 ? ' · esta semana' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/taller">
              <List className="mr-1.5 h-4 w-4" />
              Lista
            </Link>
          </Button>
          <a
            href={`/taller/agenda?week=${offset - 1}`}
            className="inline-flex h-9 items-center rounded-lg border border-cn-line px-3 text-sm text-cn-ink-500 hover:bg-cn-cream-50"
          >
            ‹
          </a>
          {offset !== 0 && (
            <a
              href="/taller/agenda"
              className="inline-flex h-9 items-center rounded-lg border border-cn-line px-3 text-sm text-cn-ink-500 hover:bg-cn-cream-50"
            >
              Hoy
            </a>
          )}
          <a
            href={`/taller/agenda?week=${offset + 1}`}
            className="inline-flex h-9 items-center rounded-lg border border-cn-line px-3 text-sm text-cn-ink-500 hover:bg-cn-cream-50"
          >
            ›
          </a>
        </div>
      </div>

      {mechanicRows.length === 0 ? (
        <div className="rounded-xl border border-cn-line py-16 text-center">
          <p className="text-cn-ink-400 text-sm">No hay trabajo planificado.</p>
          <p className="text-cn-ink-400 mt-1 text-xs">
            Crea una orden y planifícala para que aparezca en la agenda.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/taller/nueva">Nueva orden</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Resumen "libre desde" — la respuesta directa a "¿cuándo entrego?" */}
          <div className="flex flex-wrap gap-2">
            {mechanicRows.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-lg border border-cn-line bg-white px-3 py-1.5 text-sm"
              >
                <span className="font-medium text-cn-ink-700">{m.name}</span>
                <span className="text-cn-ink-400">·</span>
                <span className="text-cn-ink-500">
                  libre desde{' '}
                  <span className="font-medium text-cn-teal-900">{freeFromLabel(m.id)}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Rejilla semanal */}
          <div className="overflow-x-auto rounded-xl border border-cn-line">
            <div className="min-w-[640px]">
              {/* Cabecera de días */}
              <div
                className="grid border-b border-cn-line bg-cn-cream-50"
                style={{ gridTemplateColumns: '120px repeat(6, 1fr)' }}
              >
                <div className="px-3 py-2" />
                {days.map((d, i) => {
                  const isToday = startOfDay(d).getTime() === todayKey
                  return (
                    <div
                      key={i}
                      className={`px-2 py-2 text-center text-xs font-medium ${isToday ? 'text-cn-teal-900' : 'text-cn-ink-500'}`}
                    >
                      {DAY_LABELS[i]} {d.getDate()}
                    </div>
                  )
                })}
              </div>

              {/* Filas por mecánico */}
              {mechanicRows.map((m) => {
                const blocks = blocksByMechanic.get(m.id) ?? []
                return (
                  <div
                    key={m.id}
                    className="grid items-center border-b border-cn-line last:border-0"
                    style={{ gridTemplateColumns: '120px repeat(6, 1fr)', minHeight: '64px' }}
                  >
                    <div className="px-3 py-2 text-sm font-medium text-cn-ink-700">{m.name}</div>
                    {/* Zona de días: rejilla de 6 columnas para colocar bloques */}
                    <div
                      className="grid h-full gap-1 px-1 py-2"
                      style={{ gridColumn: '2 / span 6', gridTemplateColumns: 'repeat(6, 1fr)' }}
                    >
                      {blocks.map((b) => (
                        <Link
                          key={b.id}
                          href={`/taller/${b.id}`}
                          className={`flex flex-col justify-center overflow-hidden rounded-md px-2 py-1.5 ${BLOCK_STYLE[b.status] ?? 'bg-gray-100 text-gray-700'}`}
                          style={{ gridColumn: `${b.startCol + 1} / span ${b.span}` }}
                        >
                          <span className="truncate text-xs font-medium">{b.label}</span>
                          <span className="truncate text-[11px] opacity-80">{b.sub}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="text-cn-ink-400 text-xs">
            {scheduledCount} trabajo{scheduledCount === 1 ? '' : 's'} planificado
            {scheduledCount === 1 ? '' : 's'} esta semana. Las órdenes se crean y planifican desde
            la ficha del vehículo o el detalle de la orden.
          </p>
        </>
      )}
    </div>
  )
}
