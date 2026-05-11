import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getResend } from '@/lib/email/client'
import { postventaDay7Html } from '@/lib/email/templates/postventa-day-7'
import { postventaDay30Html } from '@/lib/email/templates/postventa-day-30'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'

  const pendingFollowups = await db.postventaFollowup.findMany({
    where: {
      status: 'PENDIENTE',
      scheduledFor: { lte: now },
    },
    include: {
      warranty: {
        include: {
          vehicle: { select: { brand: true, model: true } },
          buyerLead: { select: { name: true, email: true } },
        },
      },
    },
  })

  let sent = 0
  let failed = 0

  for (const followup of pendingFollowups) {
    const { warranty } = followup
    if (!warranty.buyerLead?.email) {
      await db.postventaFollowup.update({
        where: { id: followup.id },
        data: { status: 'FALLIDO' },
      })
      failed++
      continue
    }

    const buyerName = warranty.buyerLead.name
    const vehicleLabel = warranty.vehicle
      ? `${warranty.vehicle.brand} ${warranty.vehicle.model}`
      : 'tu camper'

    const html =
      followup.type === 'DIA_7'
        ? postventaDay7Html({ buyerName, vehicleLabel, appUrl })
        : postventaDay30Html({ buyerName, vehicleLabel, appUrl })

    const subject =
      followup.type === 'DIA_7'
        ? `¿Qué tal va tu ${vehicleLabel}?`
        : `¡Un mes ya con tu ${vehicleLabel}!`

    try {
      await getResend().emails.send({
        from,
        to: warranty.buyerLead.email,
        subject,
        html,
      })

      await db.postventaFollowup.update({
        where: { id: followup.id },
        data: { status: 'ENVIADO', sentAt: now },
      })

      sent++
    } catch (err) {
      console.error(`[cron] followup ${followup.id} failed:`, err)
      await db.postventaFollowup.update({
        where: { id: followup.id },
        data: { status: 'FALLIDO' },
      })
      failed++
    }
  }

  return NextResponse.json({ sent, failed, total: pendingFollowups.length })
}
