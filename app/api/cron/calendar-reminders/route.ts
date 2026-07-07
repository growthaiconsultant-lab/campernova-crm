import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaCalendarDeps } from '@/lib/calendar/prisma-deps'
import { getCalendarItems } from '@/lib/calendar/aggregate'
import { groupItemsByAssignee } from '@/lib/calendar/reminders'
import { sendCalendarDigest } from '@/lib/email/send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * F6: digest diario "tu agenda de mañana". Se programa por la mañana temprano
 * (ver vercel.json). Agrupa lo agendado para mañana por responsable y envía
 * a cada uno un email con sus eventos. No bloqueante e idempotente por día.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) // mañana 00:00 local
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)

  const items = await getCalendarItems(prismaCalendarDeps(db), { from: start, to: end }, {}, now)
  const byUser = groupItemsByAssignee(items)

  if (byUser.size === 0) {
    return NextResponse.json({ sent: 0, users: 0, total: items.length })
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

  let sent = 0
  for (const user of users) {
    if (!user.email) continue
    const userItems = byUser.get(user.id) ?? []
    await sendCalendarDigest({
      to: user.email,
      userName: user.name,
      dateLabel,
      items: userItems.map((it) => ({
        kindLabel: it.kindLabel,
        title: it.title,
        timeLabel: it.allDay ? 'Todo el día' : fmtTime(it.start),
        contextLabel: it.contextLabel,
        href: it.href,
      })),
    })
    sent++
  }

  return NextResponse.json({ sent, users: users.length, total: items.length })
}
