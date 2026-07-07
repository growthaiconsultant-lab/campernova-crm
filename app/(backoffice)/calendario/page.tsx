import Link from 'next/link'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { prismaCalendarDeps } from '@/lib/calendar/prisma-deps'
import { getCalendarItems } from '@/lib/calendar/aggregate'
import type { CalendarItem, CalendarSource, CalendarTone } from '@/lib/calendar/types'
import { CalendarFilters } from './calendar-filters'

const DAY_LABELS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

const TONE_CLASSES: Record<CalendarTone, string> = {
  default: 'border-l-blue-400 bg-blue-50 text-blue-900',
  success: 'border-l-green-500 bg-green-50 text-green-900',
  warn: 'border-l-amber-400 bg-amber-50 text-amber-900',
  danger: 'border-l-red-500 bg-red-50 text-red-900',
  muted: 'border-l-slate-300 bg-slate-50 text-slate-500',
}

const SOURCE_DOT: Record<CalendarSource, string> = {
  delivery: '#16a34a',
  workorder: '#0891b2',
  followup: '#7c3aed',
  next_action: '#2563eb',
  event: '#d97706',
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function mondayOf(d: Date, offsetWeeks = 0): Date {
  const x = startOfDay(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff + offsetWeeks * 7)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const TZ = 'Europe/Madrid'
const fmtDay = (d: Date) =>
  d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: TZ })
const fmtTime = (d: Date) =>
  d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: TZ })

/** Fecha local como YYYY-MM-DD (evita el desfase de toISOString en UTC+). */
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function ItemCard({ item }: { item: CalendarItem }) {
  return (
    <Link
      href={item.href}
      className={`block rounded-md border-l-[3px] px-2 py-1.5 text-left transition-opacity hover:opacity-80 ${TONE_CLASSES[item.tone]}`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: SOURCE_DOT[item.source] }}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
          {item.kindLabel}
        </span>
        {!item.allDay && (
          <span className="ml-auto font-mono text-[10px]">{fmtTime(item.start)}</span>
        )}
      </div>
      <p className="mt-0.5 truncate text-[12px] font-medium">{item.title}</p>
      {item.assigneeName && (
        <p className="truncate text-[10px] opacity-70">→ {item.assigneeName}</p>
      )}
    </Link>
  )
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: {
    week?: string
    month?: string
    view?: string
    date?: string
    source?: string
    assignee?: string
  }
}) {
  await requireAuth()

  const view =
    searchParams.view === 'day' ? 'day' : searchParams.view === 'month' ? 'month' : 'week'
  const now = new Date()

  // Filtros
  const sources = searchParams.source
    ? (searchParams.source.split(',').filter(Boolean) as CalendarSource[])
    : undefined
  const assigneeId = searchParams.assignee || null

  // Rango visible
  let from: Date
  let to: Date
  let dayList: Date[]
  let offset = 0
  let monthOffset = 0
  let monthBaseMonth = now.getMonth()
  if (view === 'day') {
    const base = searchParams.date ? startOfDay(new Date(searchParams.date)) : startOfDay(now)
    from = base
    to = addDays(base, 1)
    dayList = [base]
  } else if (view === 'month') {
    monthOffset = Number.parseInt(searchParams.month ?? '0', 10) || 0
    const monthFirst = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    monthBaseMonth = monthFirst.getMonth()
    const monthLast = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0)
    from = mondayOf(monthFirst)
    to = addDays(mondayOf(monthLast), 7) // domingo de la última semana + 1
    const total = Math.round((to.getTime() - from.getTime()) / 86_400_000)
    dayList = Array.from({ length: total }, (_, i) => addDays(from, i))
  } else {
    offset = Number.parseInt(searchParams.week ?? '0', 10) || 0
    const monday = mondayOf(now, offset)
    from = monday
    to = addDays(monday, 7)
    dayList = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  }

  const [items, agents] = await Promise.all([
    getCalendarItems(prismaCalendarDeps(db), { from, to }, { sources, assigneeId }, now),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // Agrupar por día
  const byDay = new Map<number, CalendarItem[]>()
  for (const it of items) {
    const key = startOfDay(it.start).getTime()
    const list = byDay.get(key) ?? []
    list.push(it)
    byDay.set(key, list)
  }

  const todayKey = startOfDay(now).getTime()
  const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const periodLabel =
    view === 'day'
      ? dayList[0].toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: TZ,
        })
      : view === 'month'
        ? monthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: TZ })
        : `Semana del ${fmtDay(dayList[0])} al ${fmtDay(dayList[6])}`

  // Filas de semanas para la vista mensual (chunks de 7)
  const monthWeeks: Date[][] = []
  if (view === 'month') {
    for (let i = 0; i < dayList.length; i += 7) monthWeeks.push(dayList.slice(i, i + 7))
  }

  const navBase = (params: Record<string, string>) => {
    const sp = new URLSearchParams()
    if (searchParams.source) sp.set('source', searchParams.source)
    if (searchParams.assignee) sp.set('assignee', searchParams.assignee)
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
    const qs = sp.toString()
    return `/calendario${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="-mx-6 -mt-6">
      <header className="z-20 flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 md:px-8 lg:sticky lg:top-0 lg:h-[73px] lg:py-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            CRM · Operación
          </div>
          <h1 className="mt-0.5 text-[20px] font-bold tracking-tight text-foreground">
            Calendario
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/calendario/nuevo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-[12.5px] font-semibold text-background transition-opacity hover:opacity-90"
          >
            + Nuevo evento
          </Link>
          {/* Toggle vista */}
          <div className="flex overflow-hidden rounded-lg border border-border">
            <Link
              href={navBase({ view: 'week', week: String(offset) })}
              className={`px-3 py-1.5 text-[12.5px] font-medium ${view === 'week' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Semana
            </Link>
            <Link
              href={navBase({ view: 'day' })}
              className={`px-3 py-1.5 text-[12.5px] font-medium ${view === 'day' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Día
            </Link>
            <Link
              href={navBase({ view: 'month', month: String(monthOffset) })}
              className={`px-3 py-1.5 text-[12.5px] font-medium ${view === 'month' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Mes
            </Link>
          </div>
          {/* Navegación semana */}
          {view === 'week' && (
            <div className="flex items-center gap-1">
              <Link
                href={navBase({ view: 'week', week: String(offset - 1) })}
                className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm text-muted-foreground hover:bg-muted"
              >
                ‹
              </Link>
              {offset !== 0 && (
                <Link
                  href={navBase({ view: 'week' })}
                  className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-[12.5px] text-muted-foreground hover:bg-muted"
                >
                  Hoy
                </Link>
              )}
              <Link
                href={navBase({ view: 'week', week: String(offset + 1) })}
                className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm text-muted-foreground hover:bg-muted"
              >
                ›
              </Link>
            </div>
          )}
          {/* Navegación mes */}
          {view === 'month' && (
            <div className="flex items-center gap-1">
              <Link
                href={navBase({ view: 'month', month: String(monthOffset - 1) })}
                className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm text-muted-foreground hover:bg-muted"
              >
                ‹
              </Link>
              {monthOffset !== 0 && (
                <Link
                  href={navBase({ view: 'month' })}
                  className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-[12.5px] text-muted-foreground hover:bg-muted"
                >
                  Hoy
                </Link>
              )}
              <Link
                href={navBase({ view: 'month', month: String(monthOffset + 1) })}
                className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm text-muted-foreground hover:bg-muted"
              >
                ›
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="px-4 pb-16 pt-4 md:px-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground first-letter:uppercase">{periodLabel}</p>
          <CalendarFilters agents={agents} />
        </div>

        {view === 'month' ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="min-w-[720px]">
              {/* Cabecera de días */}
              <div
                className="grid border-b border-border"
                style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
              >
                {DAY_LABELS.map((l) => (
                  <div
                    key={l}
                    className="px-2 py-2 text-center text-[11px] font-medium capitalize text-muted-foreground"
                  >
                    {l}
                  </div>
                ))}
              </div>
              {/* Semanas */}
              {monthWeeks.map((week, wi) => (
                <div
                  key={wi}
                  className="grid border-b border-border last:border-b-0"
                  style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
                >
                  {week.map((d, di) => {
                    const key = startOfDay(d).getTime()
                    const dayItems = byDay.get(key) ?? []
                    const isToday = key === todayKey
                    const inMonth = d.getMonth() === monthBaseMonth
                    return (
                      <div
                        key={di}
                        className={`min-h-[104px] border-r border-border p-1 last:border-r-0 ${inMonth ? '' : 'bg-muted/30'}`}
                      >
                        <Link
                          href={navBase({ view: 'day', date: ymd(d) })}
                          className={`mb-1 block text-right text-[11px] font-medium ${
                            isToday
                              ? 'text-foreground'
                              : inMonth
                                ? 'text-muted-foreground'
                                : 'text-muted-foreground/40'
                          }`}
                        >
                          <span
                            className={
                              isToday
                                ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background'
                                : ''
                            }
                          >
                            {d.getDate()}
                          </span>
                        </Link>
                        <div className="space-y-0.5">
                          {dayItems.slice(0, 3).map((it) => (
                            <Link
                              key={it.id}
                              href={it.href}
                              className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium ${TONE_CLASSES[it.tone]}`}
                              title={it.title}
                            >
                              {!it.allDay ? `${fmtTime(it.start)} ` : ''}
                              {it.title}
                            </Link>
                          ))}
                          {dayItems.length > 3 && (
                            <Link
                              href={navBase({
                                view: 'day',
                                date: ymd(d),
                              })}
                              className="block px-1 text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              +{dayItems.length - 3} más
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : view === 'week' ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="grid min-w-[900px]" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {dayList.map((d, i) => {
                const key = startOfDay(d).getTime()
                const dayItems = byDay.get(key) ?? []
                const isToday = key === todayKey
                return (
                  <div key={i} className="min-h-[320px] border-r border-border last:border-r-0">
                    <div
                      className={`border-b border-border px-2 py-2 text-center text-[11px] font-medium ${isToday ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                    >
                      {DAY_LABELS[i]} {d.getDate()}
                    </div>
                    <div className="space-y-1.5 p-1.5">
                      {dayItems.length === 0 ? (
                        <p className="px-1 py-4 text-center text-[10px] text-muted-foreground/50">
                          —
                        </p>
                      ) : (
                        dayItems.map((it) => <ItemCard key={it.id} item={it} />)
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            {items.length === 0 ? (
              <p className="px-6 py-16 text-center text-sm text-muted-foreground">
                No hay eventos para este día.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-14 shrink-0 text-right font-mono text-[12px] text-muted-foreground">
                      {it.allDay ? 'todo' : fmtTime(it.start)}
                    </div>
                    <div className="flex-1">
                      <ItemCard item={it} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Leyenda */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
          {(
            [
              ['delivery', 'Entregas'],
              ['workorder', 'Taller'],
              ['next_action', 'Próximas acciones'],
              ['followup', 'Postventa'],
            ] as [CalendarSource, string][]
          ).map(([s, label]) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: SOURCE_DOT[s] }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
