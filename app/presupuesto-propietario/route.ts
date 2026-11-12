import { randomBytes } from 'node:crypto'
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
function page(body: string, status = 200, script = '') {
  const nonce = randomBytes(16).toString('base64')
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Presupuesto de reparaciones · CampersNova</title>
  <style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;background:#f4f6f5;color:#182c25;font:1rem/1.5 system-ui,sans-serif}header{background:#213e33;color:white;padding:1rem max(1rem,calc((100vw - 42rem)/2));font-weight:700}main{max-width:42rem;margin:2rem auto;padding:1.5rem;background:white;border-radius:1rem;overflow-wrap:anywhere}h1{line-height:1.15;font-size:1.8rem;margin:.25rem 0}h2{font-size:1.15rem}ul{list-style:none;padding:0}li{display:flex;justify-content:space-between;gap:1rem;border-bottom:1px solid #dce5df;padding:.8rem 0}li span{white-space:nowrap}textarea{display:block;width:100%;padding:.6rem;font:inherit}button{margin:.75rem .5rem 0 0;border:1px solid #366853;border-radius:.45rem;padding:.65rem 1rem;background:white;color:#264e3f;font:inherit;cursor:pointer}button.primary{color:white;background:#366853}.total{font-weight:700;font-size:1.2rem;text-align:right}.estado{display:inline-block;padding:.25rem .65rem;background:#ebf3ef;border-radius:.4rem;font-weight:600}details{margin-top:1.5rem}summary{cursor:pointer}label{display:block;margin:.6rem 0}</style></head>
  <body><header>CampersNova · Taller</header><main>${body}</main>${script ? `<script nonce="${nonce}">${script}</script>` : ''}</body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
      },
    }
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
  if (parsed.data) revalidatePath('/taller/' + q.workOrderId)
  if (q.status === 'SUSTITUIDO')
    return page(
      '<h1>Este presupuesto se ha sustituido</h1><p>Consulta la versión más reciente en tu correo.</p>'
    )
  const lines = quoteLines.parse(q.lines)
  const auth = '<input type="hidden" name="token" value="' + escape(token) + '">'
  const actions =
    q.status === 'PENDIENTE'
      ? `<form method="post">${auth}<button class="primary" name="decision" value="ACEPTADO">Aceptar presupuesto de ${euro(quoteTotal(lines))}</button></form><details><summary>Rechazar presupuesto</summary><form method="post">${auth}<label>Motivo del rechazo (opcional)<textarea name="reason" rows="2" maxlength="500"></textarea></label><button name="decision" value="RECHAZADO">Confirmar rechazo</button></form></details>`
      : `<p>Respuesta registrada el ${q.answeredAt?.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) ?? ''}.</p>${q.reason ? '<p>Motivo · ' + escape(q.reason) + '</p>' : ''}`
  return page(`<p>Versión ${q.version}</p><h1>Presupuesto de reparaciones</h1><p>${escape(q.vehicleLabel ?? '')}${q.ownerName ? ' · ' + escape(q.ownerName) : ''}</p>
    <p class="estado">${quoteLabels[q.status]}</p><h2>Trabajos propuestos</h2><ul>${lines.map((l) => `<li><div><strong>${escape(l.item)}</strong><br>${escape(l.description)}</div><span>${euro(l.cents ?? 0)}</span></li>`).join('')}</ul>
    <p class="total">Total con IVA · ${euro(quoteTotal(lines))}</p>${actions}`)
}
