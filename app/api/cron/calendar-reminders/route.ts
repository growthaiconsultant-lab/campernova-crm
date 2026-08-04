import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaCalendarDeps } from '@/lib/calendar/prisma-deps'
import { getCalendarItems } from '@/lib/calendar/aggregate'
import { groupItemsByAssignee } from '@/lib/calendar/reminders'
import { sendCalendarDigest } from '@/lib/email/send'
import { isCronRequestAuthorized } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * F6: digest diario "tu agenda de mañana". Se programa por la mañana temprano
 * (ver vercel.json). Agrupa lo agendado para mañana por responsable y envía
 * a cada uno un email con sus eventos. No bloqueante e idempotente por día.
 */
export async function GET(request: Request) {
  const startedAt = Date.now()
  if (!isCronRequestAuthorized(request)) {
    console.warn(JSON.stringify({ event: 'cron.auth_rejected', job: 'calendar-reminders' }))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) // mañana 00:00 local
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)

  const items = await getCalendarItems(prismaCalendarDeps(db), { from: start, to: end }, {}, now)
  const byUser = groupItemsByAssignee(items)

  if (byUser.size === 0) {
    const result = { sent: 0, failed: 0, users: 0, total: items.length }
    console.info(
      JSON.stringify({
        event: 'cron.completed',
        job: 'calendar-reminders',
        ...result,
        durationMs: Date.now() - startedAt,
      })
    )
    return NextResponse.json(result)
  }

  const users = await db.user.findMany({
    where: { id: { in: Array.from(byUser.keys()) }, active: true },
    select: { id: true, name: true, email: true },
  })

  const dateLabel = start.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Madrid',
  })
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })

  const targetDate = start.toISOString().slice(0, 10)
  let sent = 0
  let failed = 0
  for (const user of users) {
    if (!user.email) continue
    const userItems = byUser.get(user.id) ?? []
    const delivered = await sendCalendarDigest({
      to: user.email,
      userName: user.name,
      dateLabel,
      idempotencyKey: `calendar-digest/${targetDate}/${user.id}`,
      items: userItems.map((it) => ({
        kindLabel: it.kindLabel,
        title: it.title,
        timeLabel: it.allDay ? 'Todo el día' : fmtTime(it.start),
        contextLabel: it.contextLabel,
        href: it.href,
      })),
    })
    if (delivered) sent++
    else failed++
  }

  const result = { sent, failed, users: users.length, total: items.length }
  console.info(
    JSON.stringify({
      event: 'cron.completed',
      job: 'calendar-reminders',
      ...result,
      durationMs: Date.now() - startedAt,
    })
  )
  return NextResponse.json(result)
}
