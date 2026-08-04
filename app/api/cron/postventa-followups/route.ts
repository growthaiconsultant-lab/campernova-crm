import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getResend } from '@/lib/email/client'
import { postventaDay7Html } from '@/lib/email/templates/postventa-day-7'
import { postventaDay30Html } from '@/lib/email/templates/postventa-day-30'
import { isCronRequestAuthorized } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const startedAt = Date.now()
  if (!isCronRequestAuthorized(request)) {
    console.warn(JSON.stringify({ event: 'cron.auth_rejected', job: 'postventa-followups' }))
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
      await db.postventaFollowup.updateMany({
        where: { id: followup.id, status: 'PENDIENTE' },
        data: { status: 'FALLIDO' },
      })
      failed++
      continue
    }

    const buyerName = warranty.buyerLead.name ?? 'Cliente'
    const vehicleLabel = warranty.vehicle
      ? [warranty.vehicle.brand, warranty.vehicle.model].filter(Boolean).join(' ') || 'tu camper'
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
      const { error } = await getResend().emails.send(
        {
          from,
          to: warranty.buyerLead.email,
          subject,
          html,
        },
        { idempotencyKey: `postventa-followup/${followup.id}` }
      )
      if (error) throw new Error('RESEND_REJECTED')

      // Una ejecución concurrente puede haber marcado FALLIDO al recibir el 409
      // temporal de idempotencia; el envío confirmado siempre converge a ENVIADO.
      await db.postventaFollowup.updateMany({
        where: { id: followup.id, status: { in: ['PENDIENTE', 'FALLIDO'] } },
        data: { status: 'ENVIADO', sentAt: now },
      })

      sent++
    } catch {
      console.error(
        JSON.stringify({
          event: 'cron.item_failed',
          job: 'postventa-followups',
          itemId: followup.id,
        })
      )
      await db.postventaFollowup.updateMany({
        where: { id: followup.id, status: 'PENDIENTE' },
        data: { status: 'FALLIDO' },
      })
      failed++
    }
  }

  const result = { sent, failed, total: pendingFollowups.length }
  console.info(
    JSON.stringify({
      event: 'cron.completed',
      job: 'postventa-followups',
      ...result,
      durationMs: Date.now() - startedAt,
    })
  )
  return NextResponse.json(result)
}
