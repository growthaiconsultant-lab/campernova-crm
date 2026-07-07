type DigestItem = {
  kindLabel: string
  title: string
  timeLabel: string
  contextLabel: string | null
  href: string
}

/** Digest diario "tu agenda de mañana" (F6). */
export function calendarDigestHtml(params: {
  userName: string
  dateLabel: string
  items: DigestItem[]
  appUrl: string
}): string {
  const { userName, dateLabel, items, appUrl } = params
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;white-space:nowrap;font-family:monospace;color:#555;">${it.timeLabel}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">
          <span style="display:inline-block;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#888;">${it.kindLabel}</span><br/>
          <a href="${appUrl}${it.href}" style="color:#0a0a0a;text-decoration:none;font-weight:600;">${it.title}</a>
          ${it.contextLabel ? `<br/><span style="font-size:12px;color:#777;">${it.contextLabel}</span>` : ''}
        </td>
      </tr>`
    )
    .join('')

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    <h2 style="font-size:18px;margin:0 0 4px;">Tu agenda · ${dateLabel}</h2>
    <p style="margin:0 0 16px;color:#666;font-size:14px;">Hola ${userName}, esto es lo que tienes agendado:</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden;">
      ${rows}
    </table>
    <p style="margin:16px 0 0;">
      <a href="${appUrl}/calendario" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;">Abrir calendario</a>
    </p>
    <p style="margin:16px 0 0;font-size:11px;color:#aaa;">CampersNova CRM · recordatorio automático</p>
  </div>`
}

/** Aviso inmediato: te han asignado un evento (F6). */
export function calendarEventAssignedHtml(params: {
  assigneeName: string
  eventTitle: string
  kindLabel: string
  whenLabel: string
  contextLabel: string | null
  href: string
  appUrl: string
}): string {
  const { assigneeName, eventTitle, kindLabel, whenLabel, contextLabel, href, appUrl } = params
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;">
    <h2 style="font-size:18px;margin:0 0 4px;">Te han asignado ${kindLabel.toLowerCase()}</h2>
    <p style="margin:0 0 16px;color:#666;font-size:14px;">Hola ${assigneeName}:</p>
    <div style="border:1px solid #eee;border-radius:8px;padding:16px;">
      <p style="margin:0;font-weight:600;font-size:15px;">${eventTitle}</p>
      <p style="margin:6px 0 0;color:#555;font-size:13px;">${whenLabel}${contextLabel ? ` · ${contextLabel}` : ''}</p>
    </div>
    <p style="margin:16px 0 0;">
      <a href="${appUrl}${href}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;">Ver evento</a>
    </p>
    <p style="margin:16px 0 0;font-size:11px;color:#aaa;">CampersNova CRM</p>
  </div>`
}
