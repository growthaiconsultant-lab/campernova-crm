import { randomBytes } from 'node:crypto'

export function page(body: string, status = 200, script = '') {
  const nonce = randomBytes(16).toString('base64')
  return new Response(
    `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Presupuesto de reparaciones · CampersNova</title>
<style nonce="${nonce}">
  :root { color-scheme: light; --forest: #1d352b; --cream: #f6f2e8; --teal: #2e5e59; --line: #e6dfd0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: clamp(8px, 3vw, 32px); background: var(--cream); color: #2a2622; font: 16px/1.5 Arial, Helvetica, sans-serif; }
  article { max-width: 690px; margin: 0 auto; background: white; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; overflow-wrap: anywhere; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px clamp(18px, 4vw, 32px); background: var(--forest); color: var(--cream); font-size: 14px; }
  header img { display: block; width: 116px; height: 51px; object-fit: contain; }
  main { padding: clamp(18px, 4vw, 32px); }
  .meta, .actions { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
  .meta { justify-content: space-between; align-items: center; color: #625748; font-size: 14px; }
  .status { display: inline-flex; align-items: center; gap: 7px; border-radius: 20px; padding: 4px 10px; font-weight: 600; background: #f6efdf; color: #6e4b1e; }
  .status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .ACEPTADO { color: #235341; background: #e7f1e9; }
  .RECHAZADO { color: #804c41; background: #f8ece6; }
  h1 { margin: 0 0 18px; color: var(--forest); font: normal clamp(28px, 5vw, 36px)/1.12 Georgia, serif; letter-spacing: -.025em; }
  .meta + h1 { margin-top: 12px; }
  .overview { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 20px; border-radius: 8px; color: var(--forest); background: var(--cream); }
  .overview strong, .label { display: block; }
  .overview strong { font-size: 19px; }
  .label { font-size: 14px; color: #625748; }
  .total { flex: none; text-align: right; }
  .total strong { font: normal 29px/1.25 Georgia, serif; }
  h2 { margin: 24px 0 0; color: var(--forest); font-size: 18px; }
  ul { list-style: none; padding: 0; margin: 0 0 20px; }
  li { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); }
  li span { flex: none; font-weight: 600; font-variant-numeric: tabular-nums; }
  p { margin: 4px 0 0; color: #514b43; }
  li p, .receipt p { font-size: 15px; white-space: pre-line; }
  button, summary { display: block; min-height: 44px; text-align: center; cursor: pointer; background: white; color: var(--teal); border: 1px solid #bac9c2; border-radius: 6px; padding: 11px 15px; font: 600 15px/1.4 Arial, sans-serif; }
  button.primary { background: var(--teal); color: white; border-color: var(--teal); }
  button:hover, summary:hover { filter: brightness(.94); }
  :focus-visible { outline: 3px solid #95621d; outline-offset: 2px; }
  details summary::-webkit-details-marker, .open-label, details[open] .closed-label { display: none; }
  details[open] .open-label { display: inline; }
  details[open] { width: 100%; }
  details[open] summary { width: fit-content; margin-bottom: 12px; }
  .actions:has(details[open]) > form { display: none; }
  textarea { display: block; width: 100%; margin: 6px 0 12px; padding: 8px; border: 1px solid #9baa9f; border-radius: 6px; resize: vertical; font: inherit; }
  .receipt { border-left: 3px solid var(--teal); padding: 4px 12px; }
  footer { padding: 16px clamp(18px, 4vw, 32px); border-top: 1px solid var(--line); color: #514b43; font-size: 14px; }
  footer strong { display: block; color: var(--forest); }
  a { color: var(--teal); }
  @media(max-width: 480px) {
    .overview, .actions { display: grid; }
    .overview { gap: 10px; }
    .total { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; border-top: 1px solid #ded6c6; padding-top: 10px; }
    button { width: 100%; }
  }
</style></head>
<body><article>
  <header><img src="/cn-landing/img/logo-cn-crema.png" width="116" height="51" alt="CampersNova"><span>Taller</span></header>
  <main>${body}</main>
  <footer><strong>El equipo de taller de CampersNova</strong>¿Tienes alguna duda? Escríbenos a <a href="mailto:info@campersnova.com">info@campersnova.com</a>.</footer>
</article>${script ? `<script nonce="${nonce}">${script}</script>` : ''}</body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; img-src 'self'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
      },
    }
  )
}
