import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { normalizePhone } from '@/lib/phone'
import { openSurveyInvitation, validSurveySecret } from '@/lib/surveys/invitation'

const requestSchema = z.object({
  invitation: z.string().min(43).max(450),
  method: z.enum(['email', 'telefono']),
  contact: z.string().trim().min(1).max(254),
})

function matchesSecret(request: Request) {
  const key = process.env.SURVEY_CRM_READ_TOKEN
  const provided = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1]
  return (
    validSurveySecret(key) &&
    validSurveySecret(provided) &&
    timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(provided, 'hex'))
  )
}

function respond(status: number, body: unknown = { ok: false }) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function normalizedPhone(value: string) {
  if (!/^\+?[\d ().-]+$/.test(value)) return ''
  const digits = normalizePhone(value)
  return /^[89]\d{8}$/.test(digits) ? '34' + digits : digits
}

export async function POST(request: Request) {
  if (!matchesSecret(request)) return respond(401)

  let payload: unknown
  try {
    const raw = await request.text()
    if (raw.length > 1500) return respond(413)
    payload = JSON.parse(raw)
  } catch {
    return respond(400)
  }
  const parsed = requestSchema.safeParse(payload)
  if (!parsed.success) return respond(400)
  const { invitation, method, contact } = parsed.data
  const claim = await openSurveyInvitation(invitation, process.env.SURVEY_CRM_INVITE_KEY)
  if (!claim) return respond(422)
  const provided = method === 'email' ? contact.toLowerCase() : normalizedPhone(contact)
  if (method === 'email' ? !z.email().safeParse(provided).success : !/^\d{7,15}$/.test(provided)) {
    return respond(422)
  }

  try {
    const profileFields = { id: true, name: true, email: true, phone: true } as const
    const where = { id: claim.leadId }
    const buyer =
      claim.kind === 'buyer'
        ? await db.buyerLead.findUnique({
            where,
            select: { ...profileFields, mergedInto: { select: profileFields } },
          })
        : null
    const profile =
      claim.kind === 'buyer'
        ? (buyer?.mergedInto ?? buyer)
        : await db.sellerLead.findUnique({ where, select: profileFields })
    const name = profile?.name?.trim()
    if (!profile || !name) return respond(422)

    const registered =
      method === 'email'
        ? profile.email?.trim().toLowerCase()
        : normalizedPhone(profile.phone ?? '')
    if (!registered || registered !== provided) return respond(422)
    return respond(200, { leadId: profile.id, firstName: name.split(/\s+/)[0].slice(0, 80) })
  } catch {
    console.warn('survey_identity_unavailable')
    return respond(503)
  }
}
