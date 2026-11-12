import { page } from './document'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { verifyQuoteLink } from '@/lib/email/owner-quote'
import { recordQuoteDelivery } from '@/lib/entry/owner-quote-store'
import { euro, quoteLabels, quoteLines, quoteTotal } from '@/lib/entry/owner-quote'

export const dynamic = 'force-dynamic'

function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
}
const unavailable = () =>
  page(
    '<h1>Enlace no disponible</h1><p>Abre el enlace completo que recibiste por correo o contacta con el taller.</p>',
    404
  )

// A fragment keeps the credential out of request URLs, access logs and referrers.
// Serve a self-contained document so marketing scripts never receive the link.
export function GET() {
  return page(
    '<h1>Presupuesto de reparaciones</h1><p id="msg">Abriendo tu presupuesto…</p><noscript>Activa JavaScript para abrir tu enlace privado.</noscript><form method="post"><input name="token" type="hidden"></form>',
    200,
    "const t=location.hash.slice(1); if(t){history.replaceState(null,'',location.pathname);document.forms[0].elements.token.value=t;document.forms[0].submit()}else{document.getElementById('msg').textContent='Abre el enlace completo que recibiste por correo.'}"
  )
}

const answer = z.enum(['ACEPTADO', 'RECHAZADO'])
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const token = form?.get('token')
  if (typeof token !== 'string' || token.length > 100) return unavailable()
  const id = verifyQuoteLink(token)
  if (!id) return unavailable()
  const decision = form?.get('decision'),
    reason = form?.get('reason') ?? ''
  const parsed = answer.optional().safeParse(decision ?? undefined)
  if (!parsed.success || typeof reason !== 'string' || reason.length > 500)
    return page(
      '<h1>Respuesta no válida</h1><p>Abre el enlace de nuevo y revisa el motivo (máximo 500 caracteres).</p>',
      400
    )
  const q = await recordQuoteDelivery(id, parsed.data, reason)
  if (!q) return unavailable()
  if (parsed.data) {
    revalidatePath('/taller/' + q.workOrderId)
    if (q.status === 'ACEPTADO') revalidatePath('/dashboard')
  }
  if (q.status === 'SUSTITUIDO')
    return page(
      '<h1>Este presupuesto se ha sustituido</h1><p>Consulta la versión más reciente en tu correo.</p>'
    )
  const lines = quoteLines.parse(q.lines)
  const total = euro(quoteTotal(lines))
  const auth = '<input type="hidden" name="token" value="' + escape(token) + '">'
  const actions =
    q.status === 'PENDIENTE'
      ? `<div class="actions">
          <form method="post">${auth}<button class="primary" name="decision" value="ACEPTADO">Aceptar presupuesto de ${total}</button></form>
          <details>
            <summary><span class="closed-label">Rechazar presupuesto</span><span class="open-label">Cancelar</span></summary>
            <form method="post">${auth}
              <label for="reason">Motivo del rechazo (opcional)</label>
              <textarea id="reason" name="reason" rows="2" maxlength="500"></textarea>
              <button class="primary" name="decision" value="RECHAZADO">Confirmar rechazo</button>
            </form>
          </details>
        </div>`
      : `<section class="receipt" aria-label="Respuesta registrada">
          <strong>${q.status === 'ACEPTADO' ? 'Has aceptado el presupuesto de ' + total + '.' : 'Has rechazado el presupuesto.'}</strong>
          ${q.answeredAt ? '<p>Respuesta registrada el ' + q.answeredAt.toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' }) + '.</p>' : ''}
          ${q.reason ? '<p>Motivo · ' + escape(q.reason) + '</p>' : ''}
        </section>`
  return page(`
    <div class="meta"><span>Presupuesto · Versión ${q.version}</span><span class="status ${q.status}">${quoteLabels[q.status]}</span></div>
    <h1>Tu presupuesto de reparaciones</h1>
    <section class="overview" aria-label="Resumen del presupuesto">
      <div><span class="label">Vehículo</span><strong>${escape(q.vehicleLabel || 'Tu vehículo')}</strong>
        ${q.ownerName ? '<span class="label">A nombre de ' + escape(q.ownerName) + '</span>' : ''}
      </div>
      <div class="total"><span class="label">Total con IVA</span><strong>${total}</strong></div>
    </section>
    <h2>Trabajos propuestos</h2>
    <ul>${lines.map((l) => `<li><div><strong>${escape(l.item)}</strong><p>${escape(l.description)}</p></div><span>${euro(l.cents ?? 0)}</span></li>`).join('')}</ul>
    ${actions}`)
}
