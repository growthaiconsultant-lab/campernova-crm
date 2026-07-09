import Link from 'next/link'
import { Suspense } from 'react'
import { Clock, Flame, CalendarDays } from 'lucide-react'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getComercialKpis, type ActionRow } from '@/lib/kpi/comercial'
import { getCalendarItems } from '@/lib/calendar/aggregate'
import { prismaCalendarDeps } from '@/lib/calendar/prisma-deps'
import type { CalendarTone } from '@/lib/calendar/types'
import { ForbiddenToast } from '@/components/forbidden-toast'
import { DashboardFilters } from './dashboard-filters'
import { Card, KpiCard, ButtonLink } from '@/components/redesign'
import { cn } from '@/lib/utils'

/**
 * Dashboard «Mi día» (mockup D1/M1): la pantalla de inicio operativa — qué
 * tengo que hacer hoy, qué está caliente y qué está en riesgo. Cards de
 * resumen + lista priorizada de acciones + agenda del día.
 * Los datos financieros/analíticos viven en /analytics/* (B21).
 */

const TZ = 'Europe/Madrid'

const TONE_HEX: Record<CalendarTone, string> = {
  default: '#0e7d6b',
  success: '#1a9d5f',
  warn: '#c9820a',
  danger: '#d64545',
  muted: '#8b94a3',
}

const PRIORITY_STYLES: Record<ActionRow['priority'], string> = {
  red: 'bg-bad-tint text-bad',
  amber: 'bg-warn-tint text-warn',
  green: 'bg-track text-ink2',
}

function greetingFor(now: Date): string {
  const hour = parseInt(
    now.toLocaleTimeString('es-ES', { hour: '2-digit', hour12: false, timeZone: TZ }),
    10
  )
  if (hour < 14) return 'Buenos días'
  if (hour < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { agent?: string; error?: string }
}) {
  const currentUser = await requireAuth()
  const isAdmin = currentUser.role === 'ADMIN'
  const isAgente = currentUser.role === 'AGENTE'

  // AGENTE ve lo suyo; ADMIN puede filtrar por agente (o ver todo el equipo).
  const agentId = isAgente ? currentUser.id : (searchParams.agent ?? null)

  const now = new Date()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(now)
  dayEnd.setHours(23, 59, 59, 999)

  const [kpis, agendaItems, agents] = await Promise.all([
    getComercialKpis(db, agentId),
    getCalendarItems(
      prismaCalendarDeps(db),
      { from: dayStart, to: dayEnd },
      agentId ? { assigneeId: agentId } : {},
      now
    ),
    isAdmin
      ? db.user.findMany({
          where: { active: true, role: { in: ['ADMIN', 'AGENTE'] } },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ])

  const dateLine = now.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  })

  const appointmentTimes = agendaItems
    .filter((i) => !i.allDay)
    .slice(0, 3)
    .map((i) =>
      i.start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
    )

  const riskyReservations = kpis.reservationRows.filter((r) => r.priority === 'red').length
  const priorityList = kpis.priorityRows.slice(0, 6)

  return (
    <div className="mx-auto max-w-[1200px]">
      <Suspense>
        <ForbiddenToast />
      </Suspense>

      {/* Saludo + fecha */}
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-hanken text-[23px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
            {greetingFor(now)}, {firstName(currentUser.name)}
          </h1>
          <p className="mt-[5px] font-hanken text-[13.5px] text-ink2 first-letter:uppercase">
            {dateLine} · tienes <b className="text-ink">{kpis.tasksToday} tareas hoy</b>
            {kpis.overdueTasks > 0 && (
              <>
                {' '}
                y <b className="text-bad">{kpis.overdueTasks} vencidas</b>
              </>
            )}
          </p>
        </div>
        {isAdmin && (
          <DashboardFilters agents={agents} currentAgentId={searchParams.agent ?? null} />
        )}
      </div>

      {/* KPI cards */}
      <div className="mb-[18px] grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <KpiCard
          label="Tareas vencidas"
          value={
            <span className={kpis.overdueTasks > 0 ? 'text-bad' : undefined}>
              {kpis.overdueTasks}
            </span>
          }
          tone={kpis.overdueTasks > 0 ? 'bad' : 'good'}
          note={kpis.overdueTasks > 0 ? 'resolver primero' : 'todo al día'}
        />
        <KpiCard
          label="Compradores calientes"
          value={<span className="text-brand">{kpis.hotBuyers}</span>}
          note="temperatura alta"
          href="/compradores?temp=HOT"
        />
        <KpiCard
          label="Citas hoy"
          value={kpis.appointmentsToday}
          note={appointmentTimes.length ? appointmentTimes.join(' · ') : 'sin citas'}
          href="/calendario"
        />
        <KpiCard
          label="Reservas abiertas"
          value={kpis.activeReservations}
          note={
            riskyReservations > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] rounded-full bg-warn" aria-hidden />
                {riskyReservations} en riesgo
              </span>
            ) : (
              'sin riesgo'
            )
          }
          href="/ofertas"
        />
      </div>

      {/* Priorizado + agenda */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        {/* Tu día, priorizado */}
        <Card pad={false} className="self-start overflow-hidden">
          <div className="flex items-center justify-between px-[18px] pb-3 pt-[15px]">
            <h3 className="font-hanken text-[15px] font-bold tracking-[-0.01em] text-ink">
              Tu día, priorizado
            </h3>
          </div>
          {priorityList.length === 0 ? (
            <div className="border-t border-line2 px-[18px] py-8 text-center font-hanken text-[13px] text-ink3">
              Sin acciones pendientes. Cuando haya tareas vencidas, reservas en riesgo o compradores
              calientes, aparecerán aquí ordenadas por prioridad.
            </div>
          ) : (
            <div className="flex flex-col">
              {priorityList.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-[13px] border-t border-line2 px-[18px] py-[13px]"
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px]',
                      PRIORITY_STYLES[row.priority]
                    )}
                  >
                    {row.priority === 'red' ? (
                      <Clock size={13} strokeWidth={2.2} />
                    ) : row.priority === 'amber' ? (
                      <Flame size={13} strokeWidth={2.2} />
                    ) : (
                      <CalendarDays size={13} strokeWidth={2} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-hanken text-[13px] font-semibold text-ink">
                      {row.name}
                    </span>
                    <span className="mt-0.5 block truncate font-hanken text-[12px] font-medium text-ink3">
                      {row.reason}
                    </span>
                  </span>
                  <ButtonLink href={row.href} variant="primary" size="sm" className="shrink-0">
                    Ver ficha
                  </ButtonLink>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-line2 px-[18px] py-[11px] text-center">
            <Link
              href="/analytics/comercial"
              className="font-hanken text-[12.5px] font-semibold text-brand hover:text-brand2"
            >
              Ver todas las tareas →
            </Link>
          </div>
        </Card>

        {/* Agenda de hoy */}
        <Card className="self-start p-[18px]">
          <h3 className="mb-3.5 font-hanken text-[15px] font-bold tracking-[-0.01em] text-ink">
            Agenda de hoy
          </h3>
          {agendaItems.length === 0 ? (
            <p className="py-4 font-hanken text-[13px] text-ink3">
              Sin nada agendado para hoy. Las citas, entregas, taller y seguimientos del día
              aparecerán aquí.{' '}
              <Link href="/calendario" className="font-semibold text-brand hover:text-brand2">
                Abrir calendario →
              </Link>
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {agendaItems.slice(0, 8).map((item) => (
                <Link key={item.id} href={item.href} className="group flex items-start gap-3">
                  <span className="w-[44px] shrink-0 pt-px font-mono text-[12px] font-semibold text-ink2">
                    {item.allDay
                      ? '—'
                      : item.start.toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: TZ,
                        })}
                  </span>
                  <span
                    className="mt-[3px] h-[9px] w-[9px] shrink-0 rounded-full"
                    style={{ backgroundColor: TONE_HEX[item.tone] }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-hanken text-[12.5px] font-semibold text-ink group-hover:text-brand2">
                      {item.kindLabel} — {item.title}
                    </span>
                    {item.contextLabel && (
                      <span className="block truncate font-hanken text-[11.5px] font-medium text-ink3">
                        {item.contextLabel}
                      </span>
                    )}
                  </span>
                </Link>
              ))}
              {agendaItems.length > 8 && (
                <Link
                  href="/calendario"
                  className="pt-1 font-hanken text-[12.5px] font-semibold text-brand hover:text-brand2"
                >
                  Ver los {agendaItems.length} eventos →
                </Link>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
