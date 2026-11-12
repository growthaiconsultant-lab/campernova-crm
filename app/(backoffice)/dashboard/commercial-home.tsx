import Link from 'next/link'
import { Suspense } from 'react'
import { CalendarDays, ChevronRight, ListChecks } from 'lucide-react'
import type { User } from '@prisma/client'
import { db } from '@/lib/db'
import { getWorkday, type DayRow } from '@/lib/dashboard/workday'
import { ForbiddenToast } from '@/components/forbidden-toast'
import { DashboardFilters } from './dashboard-filters'

function Rows({ rows, team }: { rows: DayRow[]; team: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => (
        <li key={row.href + '|' + row.context}>
          <Link
            href={row.href}
            prefetch={false}
            className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-brand-tint focus-visible:bg-brand-tint"
          >
            <span className="min-w-0 break-words">
              <span
                className={
                  'block text-xs font-semibold ' +
                  (/vencid|Vence hoy/i.test(row.label)
                    ? 'text-amber-800 dark:text-amber-300'
                    : 'text-brand')
                }
              >
                {row.label}
              </span>
              <span className="block text-sm font-semibold text-ink">{row.title}</span>
              <span className="block text-sm text-ink2">
                {[
                  row.context,
                  team ? (row.owner ? 'Responsable · ' + row.owner : 'Sin asignar') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-brand" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}
function DayList({ rows, team, empty }: { rows: DayRow[]; team: boolean; empty: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      {rows.length ? (
        <Rows rows={rows.slice(0, 6)} team={team} />
      ) : (
        <p className="p-4 text-sm text-ink2">{empty}</p>
      )}
      {rows.length > 6 && (
        <details className="border-t border-line">
          <summary className="cursor-pointer p-3 text-sm font-semibold text-brand">
            Ver {rows.length - 6} más
          </summary>
          <Rows rows={rows.slice(6)} team={team} />
        </details>
      )}
    </div>
  )
}

export async function CommercialHome({
  user,
  query,
}: {
  user: Pick<User, 'id' | 'role'>
  query: { vista?: string; agent?: string }
}) {
  const admin = user.role === 'ADMIN'
  const personal = !admin || query.vista === 'mi-trabajo'
  const selectedAgent = typeof query.agent === 'string' && query.agent ? query.agent : undefined
  const owner = personal ? user.id : selectedAgent
  const now = new Date()
  const [day, agents] = await Promise.all([
    getWorkday(db, owner, now),
    admin && !personal
      ? db.user.findMany({
          where: { active: true, role: { in: ['ADMIN', 'AGENTE'] } },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : [],
  ])
  return (
    <WorkdayView admin={admin} team={!personal} owner={owner} day={day} agents={agents} now={now} />
  )
}

export function WorkdayView({
  admin,
  team,
  owner,
  day,
  agents,
  now,
}: {
  admin: boolean
  team: boolean
  owner?: string
  day: { tasks: DayRow[]; agenda: DayRow[] }
  agents: { id: string; name: string }[]
  now: Date
}) {
  const heading = team ? 'El día del equipo' : admin ? 'Mi trabajo' : 'Mi día'
  return (
    <div className="mx-auto max-w-[1200px] space-y-5" data-sentry-mask>
      <Suspense>
        <ForbiddenToast />
      </Suspense>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink2 first-letter:uppercase">
            {now.toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'Europe/Madrid',
            })}
          </p>
          <h1 className="font-hanken text-2xl font-bold tracking-tight text-ink">{heading}</h1>
        </div>
        {admin && (
          <nav
            aria-label="Ámbito del inicio"
            className="flex flex-wrap gap-1 rounded-lg border bg-card p-1"
          >
            {[
              { label: 'El día del equipo', href: '/dashboard', active: team },
              { label: 'Mi trabajo', href: '/dashboard?vista=mi-trabajo', active: !team },
            ].map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.active ? 'page' : undefined}
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold aria-[current=page]:bg-brand-tint aria-[current=page]:text-brand"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
      {team && <DashboardFilters agents={agents} currentAgentId={owner ?? null} />}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section aria-labelledby="home-tasks">
          <h2 id="home-tasks" className="mb-2 flex items-center gap-2 font-semibold">
            <ListChecks aria-hidden size={18} />
            Por hacer <span className="text-sm text-ink2">{day.tasks.length}</span>
          </h2>
          <DayList rows={day.tasks} team={team} empty="Sin tareas pendientes para hoy." />
        </section>
        <section aria-labelledby="home-agenda">
          <h2 id="home-agenda" className="mb-2 flex items-center gap-2 font-semibold">
            <CalendarDays aria-hidden size={18} />
            Agenda de hoy <span className="text-sm text-ink2">{day.agenda.length}</span>
          </h2>
          <DayList rows={day.agenda} team={team} empty="Sin citas programadas para hoy." />
          <Link
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline"
            href={'/calendario?view=day' + (owner ? '&assignee=' + encodeURIComponent(owner) : '')}
          >
            Abrir calendario →
          </Link>
        </section>
      </div>
    </div>
  )
}
