import Link from 'next/link'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { normalizePhone } from '@/lib/phone'
import { buildWhatsAppUrl } from '@/lib/whatsapp'
import {
  invitationLifetimeMs,
  isSurveyLeadId,
  sealSurveyInvitation,
  validSurveySecret,
  type SurveyLeadKind,
} from '@/lib/surveys/invitation'
import { surveyInvitationMessage } from '@/lib/surveys/message'
import { readSurveyResponses, surveyLeadPath, surveySiteUrl } from '@/lib/surveys/responses'
import { EmailInvitation } from './email-invitation'
import { SurveyResponseList } from './response-list'

export async function LeadSurveys({
  kind,
  lead,
  cursor,
}: {
  kind: SurveyLeadKind
  lead: {
    id: string
    name: string | null
    archivedAt: Date | null
    email: string | null
    phone: string | null
  }
  cursor?: string
}) {
  const aliases =
    kind === 'buyer'
      ? await db.buyerLead.findMany({ where: { mergedIntoId: lead.id }, select: { id: true } })
      : []
  const page = await readSurveyResponses({
    kind,
    leadIds: [lead.id, ...aliases.map(({ id }) => id)],
    cursor,
  })
  const key = process.env.SURVEY_CRM_INVITE_KEY
  const email = lead.email?.trim()
  const phone = lead.phone && normalizePhone(lead.phone)
  const hasEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const hasPhone = phone && /^\d{7,15}$/.test(phone)
  let invitation: { token: string; message: string } | undefined

  if (
    !lead.archivedAt &&
    lead.name?.trim() &&
    (hasEmail || hasPhone) &&
    validSurveySecret(key) &&
    isSurveyLeadId(lead.id)
  ) {
    try {
      const token = await sealSurveyInvitation(
        {
          kind,
          leadId: lead.id,
          invitationId: crypto.randomUUID(),
          expires: Date.now() + invitationLifetimeMs,
        },
        key
      )
      const url = surveySiteUrl()
      url.hash = 'i=' + token
      invitation = { token, message: surveyInvitationMessage(url.href) }
    } catch {
      console.warn('survey_invitation_unavailable')
    }
  }

  const path = surveyLeadPath(kind, lead.id)
  return (
    <section className="ph-no-capture ph-mask mx-auto max-w-4xl space-y-4" data-sentry-mask>
      <h2 className="text-lg font-semibold">Encuestas de satisfacción</h2>
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="font-medium">Enviar encuesta</h3>
        {lead.archivedAt ? (
          <p className="text-sm text-muted-foreground">
            Ficha archivada. Las respuestas siguen disponibles.
          </p>
        ) : !lead.name?.trim() || (!hasPhone && !hasEmail) ? (
          <p className="text-sm text-muted-foreground">
            Completa el nombre y al menos un teléfono o correo en la ficha para enviar una
            invitación.
          </p>
        ) : !invitation ? (
          <p className="text-sm text-muted-foreground">
            Las invitaciones todavía no están disponibles.
          </p>
        ) : (
          <div className="space-y-3">
            {phone && hasPhone && (
              <Button asChild variant="outline">
                <a
                  href={buildWhatsAppUrl(phone, invitation.message)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Preparar WhatsApp
                </a>
              </Button>
            )}
            {email && hasEmail && (
              <EmailInvitation
                token={invitation.token}
                recipient={email}
                message={invitation.message}
              />
            )}
          </div>
        )}
      </div>
      <h3 className="font-medium">Respuestas vinculadas</h3>
      {page ? (
        <SurveyResponseList rows={page.rows} />
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          No se pueden consultar las respuestas en este momento.
        </p>
      )}
      {(cursor || page?.nextCursor) && (
        <nav className="flex flex-wrap gap-4 text-sm" aria-label="Páginas de respuestas">
          {cursor && (
            <Link className="underline" href={path}>
              Volver a las más recientes
            </Link>
          )}
          {page?.nextCursor && (
            <Link
              className="underline"
              href={path + '&cursor=' + encodeURIComponent(page.nextCursor)}
            >
              Respuestas anteriores
            </Link>
          )}
        </nav>
      )}
    </section>
  )
}
