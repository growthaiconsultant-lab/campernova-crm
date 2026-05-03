import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getResend } from '@/lib/email/client'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      sessionToken?: string
      gdprConsent?: boolean
      extractedData?: {
        nombre?: string
        email?: string
        telefono?: string
        necesidad?: string
        plazas?: number
        tipo?: string
        equipamiento?: Record<string, boolean>
        zona?: string
        presupuestoMin?: number
        presupuestoMax?: number
        plazos?: string
      }
    }

    if (!body.sessionToken || !body.gdprConsent || !body.extractedData) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    }

    const { extractedData: d } = body

    if (!d.nombre || !d.email || !d.telefono) {
      return NextResponse.json({ error: 'missing_contact_data' }, { status: 400 })
    }

    const session = await db.buyerChatSession.findUnique({
      where: { sessionToken: body.sessionToken },
    })

    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }

    if (session.buyerLeadId) {
      return NextResponse.json({ error: 'already_completed' }, { status: 409 })
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      null

    const result = await db.$transaction(async (tx) => {
      const lead = await tx.buyerLead.create({
        data: {
          name: d.nombre!,
          email: d.email!,
          phone: d.telefono!,
          source: 'CHAT',
          vehicleType:
            d.tipo === 'CAMPER' ? 'CAMPER' : d.tipo === 'AUTOCARAVANA' ? 'AUTOCARAVANA' : undefined,
          minSeats: d.plazas ?? undefined,
          maxBudget: d.presupuestoMax ?? undefined,
          useZone: d.zona ?? undefined,
          purchaseTimeline: d.plazos ?? undefined,
          criticalEquipment: d.equipamiento ?? {},
        },
      })

      await tx.buyerChatSession.update({
        where: { sessionToken: body.sessionToken! },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          buyerLeadId: lead.id,
          gdprConsentAt: new Date(),
          gdprConsentIp: ip,
          capturedNombre: d.nombre,
          capturedEmail: d.email,
          capturedTelefono: d.telefono,
          capturedNecesidad: d.necesidad,
          capturedPlazas: d.plazas,
          capturedPresupuestoMin: d.presupuestoMin,
          capturedPresupuestoMax: d.presupuestoMax,
          capturedPlazos: d.plazos,
          capturedEquipamiento: d.equipamiento ?? {},
          capturedZona: d.zona,
        },
      })

      await tx.activity.create({
        data: {
          type: 'LEAD_CREADO_CHAT',
          content: `Lead creado desde chat. Necesidad: ${d.necesidad ?? 'no especificada'}`,
          buyerLeadId: lead.id,
        },
      })

      return lead
    })

    // Notify agents (non-blocking)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
    db.user
      .findMany({ where: { active: true } })
      .then(async (agents) => {
        if (agents.length === 0) return
        const resend = getResend()
        const summary = [
          d.necesidad ?? 'Sin resumen',
          d.presupuestoMin && d.presupuestoMax
            ? `${d.presupuestoMin.toLocaleString()}–${d.presupuestoMax.toLocaleString()} €`
            : '',
          d.plazos ?? '',
        ]
          .filter(Boolean)
          .join(' · ')
        const html = `<p><strong>Nuevo lead comprador (chat)</strong></p>
<p>Nombre: ${d.nombre}<br>Email: <a href="mailto:${d.email}">${d.email}</a><br>Teléfono: <a href="tel:${d.telefono}">${d.telefono}</a></p>
<p>Necesidad: ${summary}</p>
<p><a href="${appUrl}/compradores/${result.id}">Ver ficha →</a></p>`
        await Promise.all(
          agents.map((a) =>
            resend.emails
              .send({
                from,
                to: a.email,
                subject: `Nuevo lead chat: ${d.nombre} — ${summary.slice(0, 60)}`,
                html,
              })
              .catch(console.error)
          )
        )
      })
      .catch(console.error)

    return NextResponse.json({ success: true, buyerLeadId: result.id })
  } catch (err) {
    console.error('[chat/buyer/complete]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
