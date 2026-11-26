'use server'

import { z } from 'zod'
import { requireAgente } from '@/lib/auth'
import { db } from '@/lib/db'
import { getResend } from '@/lib/email/client'
import { openSurveyInvitation } from '@/lib/surveys/invitation'
import { surveyEmailSubject, surveyInvitationMessage } from '@/lib/surveys/message'
import { surveySiteUrl } from '@/lib/surveys/responses'

const requestSchema = z.object({
  token: z.string().min(43).max(450),
  recipient: z.string().email().max(254),
})

export async function sendSurveyEmail(input: unknown): Promise<{ ok: boolean; message: string }> {
  await requireAgente()
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Los datos de la invitación no son válidos.' }

  const { token, recipient } = parsed.data
  const invite = await openSurveyInvitation(token, process.env.SURVEY_CRM_INVITE_KEY)
  if (!invite)
    return { ok: false, message: 'El enlace ha caducado. Recarga la ficha para generar otro.' }

  const lead =
    invite.kind === 'buyer'
      ? await db.buyerLead.findUnique({
          where: { id: invite.leadId },
          select: { email: true, name: true, archivedAt: true, mergedIntoId: true },
        })
      : await db.sellerLead.findUnique({
          where: { id: invite.leadId },
          select: { email: true, name: true, archivedAt: true },
        })

  if (
    !lead ||
    !lead.name?.trim() ||
    lead.archivedAt ||
    ('mergedIntoId' in lead && lead.mergedIntoId)
  ) {
    return { ok: false, message: 'La ficha ya no admite envíos. Recarga para consultar su estado.' }
  }
  const email = lead.email?.trim()
  if (email !== recipient) {
    return { ok: false, message: 'El correo de la ficha ha cambiado. Recarga antes de enviar.' }
  }

  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL
  if (!from || !process.env.RESEND_API_KEY) {
    return { ok: false, message: 'El envío de correo todavía no está configurado.' }
  }

  try {
    const url = surveySiteUrl()
    url.hash = 'i=' + token
    const { error } = await getResend().emails.send(
      { from, to: email, subject: surveyEmailSubject, text: surveyInvitationMessage(url.href) },
      { idempotencyKey: 'survey-invitation/' + invite.invitationId }
    )
    if (error) {
      console.warn('survey_invitation_email_rejected')
      return {
        ok: false,
        message: 'El proveedor no confirmó el envío. Puedes reintentar desde aquí.',
      }
    }
    return { ok: true, message: 'El proveedor ha aceptado el correo para su envío.' }
  } catch {
    console.warn('survey_invitation_email_unconfirmed')
    return {
      ok: false,
      message: 'No se ha podido confirmar el envío. Puedes reintentar desde aquí.',
    }
  }
}
