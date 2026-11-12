import { createHmac, timingSafeEqual } from 'node:crypto'
import type { InspectionOwnerQuote } from '@prisma/client'
import { getResend } from './client'
import { euro, quoteLines, quoteTotal } from '../entry/owner-quote'
import { QuoteError } from '../entry/owner-quote-store'

function sign(id: string) {
  const secret = process.env.OWNER_QUOTE_LINK_SECRET
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new QuoteError('Falta configurar el enlace privado de los presupuestos.')
  return createHmac('sha256', secret)
    .update('owner-quote:v1:' + id)
    .digest('base64url')
}
export function verifyQuoteLink(token: string) {
  const match = /^(c[a-z0-9]{24})\.([A-Za-z0-9_-]{43})$/.exec(token)
  return match && timingSafeEqual(Buffer.from(match[2]), Buffer.from(sign(match[1])))
    ? match[1]
    : null
}
export function quoteMailer() {
  const base = process.env.NEXT_PUBLIC_APP_URL
  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL
  if (!base || !/^https:\/\//.test(base) || !from || !process.env.RESEND_API_KEY)
    throw new QuoteError('Falta configurar el envío de presupuestos por correo.')
  sign('configuration-check')
  const endpoint = new URL('/presupuesto-propietario', base).href
  return async (q: InspectionOwnerQuote) => {
    if (!q.ownerEmail) throw new QuoteError('Falta el correo del propietario.')
    const link = endpoint + '#' + q.id + '.' + sign(q.id)
    const total = euro(quoteTotal(quoteLines.parse(q.lines)))
    const options = {
      idempotencyKey: 'inspection-owner-quote/' + q.id,
      signal: AbortSignal.timeout(12000),
    }
    const { data, error } = await getResend().emails.send(
      {
        from,
        to: q.ownerEmail,
        subject: 'Presupuesto de reparaciones · CampersNova · v' + q.version,
        text: [
          q.ownerName ? 'Hola, ' + q.ownerName + ':' : 'Hola,',
          'El taller ha preparado el presupuesto de reparaciones de ' + q.vehicleLabel + '.',
          'Total con IVA: ' +
            total +
            '. Puedes revisar cada trabajo y aceptar o rechazar el presupuesto en tu enlace privado:',
          link,
          'Equipo de CampersNova',
        ].join('\n\n'),
      },
      options
    )
    if (error || !data?.id)
      throw new QuoteError(
        'El servicio de correo no ha confirmado el envío. Puedes reintentar esta versión.'
      )
  }
}
