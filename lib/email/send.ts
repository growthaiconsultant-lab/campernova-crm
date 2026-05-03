import { getResend } from './client'
import { sellerLeadConfirmationHtml } from './templates/seller-lead-confirmation'
import { agentLeadNotificationHtml } from './templates/agent-lead-notification'
import { matchNotificationHtml } from './templates/match-notification'
import type { RegisterBuyerLeadArgs } from '@/lib/chat/tools'

interface SendSellerLeadConfirmationParams {
  to: string
  sellerName: string
  brand: string
  model: string
  year: number
  km: number
  valuation?: { min: number; recommended: number; max: number } | null
}

export async function sendSellerLeadConfirmation(
  params: SendSellerLeadConfirmationParams
): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'

  try {
    await getResend().emails.send({
      from,
      to: params.to,
      subject: `Hemos recibido tu solicitud — ${params.brand} ${params.model}`,
      html: sellerLeadConfirmationHtml({
        sellerName: params.sellerName,
        brand: params.brand,
        model: params.model,
        year: params.year,
        km: params.km,
        valuation: params.valuation,
      }),
    })
  } catch (err) {
    // Non-blocking: log but don't throw — lead is already created
    console.error('[email] sendSellerLeadConfirmation failed:', err)
  }
}

interface SendAgentLeadNotificationParams {
  agentEmails: string[]
  leadId: string
  sellerName: string
  sellerEmail: string
  sellerPhone: string
  canal: string
  brand: string
  model: string
  year: number
  km: number
  vehicleType: string
  location: string | null
  desiredPrice: string | null
  conservationState: string
}

export async function sendAgentLeadNotification(
  params: SendAgentLeadNotificationParams
): Promise<void> {
  if (params.agentEmails.length === 0) return

  const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const html = agentLeadNotificationHtml({
    leadId: params.leadId,
    sellerName: params.sellerName,
    sellerEmail: params.sellerEmail,
    sellerPhone: params.sellerPhone,
    canal: params.canal,
    brand: params.brand,
    model: params.model,
    year: params.year,
    km: params.km,
    vehicleType: params.vehicleType,
    location: params.location,
    desiredPrice: params.desiredPrice,
    conservationState: params.conservationState,
    appUrl,
  })

  try {
    // Send individually so each agent gets a personal notification
    await Promise.all(
      params.agentEmails.map((to) =>
        getResend().emails.send({
          from,
          to,
          subject: `Nuevo lead — ${params.brand} ${params.model} (${params.canal})`,
          html,
        })
      )
    )
  } catch (err) {
    // Non-blocking: log but don't throw — lead is already created
    console.error('[email] sendAgentLeadNotification failed:', err)
  }
}

interface SendMatchNotificationParams {
  to: string
  agentName: string
  score: number
  vehicleSummary: string
  buyerSummary: string
  ctaPath: string
  ctaLabel: string
}

export async function sendBuyerChatLeadNotification(
  lead: { id: string },
  args: RegisterBuyerLeadArgs,
  agentEmails: string[]
): Promise<void> {
  if (agentEmails.length === 0) return

  const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const summary = [
    args.necesidad,
    args.presupuestoMin && args.presupuestoMax
      ? `${args.presupuestoMin.toLocaleString()}–${args.presupuestoMax.toLocaleString()} €`
      : args.presupuestoMax
        ? `hasta ${args.presupuestoMax.toLocaleString()} €`
        : '',
    args.plazos ?? '',
  ]
    .filter(Boolean)
    .join(' · ')

  const html = `<p><strong>Nuevo lead comprador (chat)</strong></p>
<p>Nombre: ${args.nombre}<br>Email: <a href="mailto:${args.email}">${args.email}</a><br>Teléfono: <a href="tel:${args.telefono}">${args.telefono}</a></p>
<p>Necesidad: ${summary}</p>
<p><a href="${appUrl}/compradores/${lead.id}">Ver ficha →</a></p>`

  try {
    await Promise.all(
      agentEmails.map((to) =>
        getResend()
          .emails.send({
            from,
            to,
            subject: `Nuevo lead chat: ${args.nombre} — ${summary.slice(0, 60)}`,
            html,
          })
          .catch(console.error)
      )
    )
  } catch (err) {
    console.error('[email] sendBuyerChatLeadNotification failed:', err)
  }
}

export async function sendMatchNotification(params: SendMatchNotificationParams): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    await getResend().emails.send({
      from,
      to: params.to,
      subject: `Nuevo match score ${params.score} — ${params.vehicleSummary}`,
      html: matchNotificationHtml({
        agentName: params.agentName,
        score: params.score,
        vehicleSummary: params.vehicleSummary,
        buyerSummary: params.buyerSummary,
        ctaUrl: `${appUrl}${params.ctaPath}`,
        ctaLabel: params.ctaLabel,
      }),
    })
  } catch (err) {
    // Non-blocking: log but don't throw — match is already created
    console.error('[email] sendMatchNotification failed:', err)
  }
}
