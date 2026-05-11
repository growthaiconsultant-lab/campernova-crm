interface TicketOpenedParams {
  adminEmails: string[]
  ticketTitle: string
  priority: string
  ticketId: string
  appUrl: string
}

export function ticketOpenedHtml(p: Omit<TicketOpenedParams, 'adminEmails'>): string {
  const priorityColor = p.priority === 'CRITICA' ? '#dc2626' : '#f59e0b'
  const priorityLabel = p.priority === 'CRITICA' ? '🚨 CRÍTICA' : '⚠️ ALTA'

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Ticket postventa ${priorityLabel}</title></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
  <p style="display:inline-block;background:${priorityColor};color:#fff;padding:4px 12px;border-radius:4px;font-size:13px;font-weight:700;margin:0 0 16px">${priorityLabel}</p>
  <h1 style="font-size:20px;margin:0 0 8px">Nuevo ticket de postventa</h1>
  <p style="color:#6b7280;margin:0 0 24px">Se ha abierto un ticket que requiere tu atención.</p>

  <table style="width:100%;border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse;margin:0 0 24px">
    <tr>
      <td style="padding:12px 16px;background:#f9fafb;font-weight:600;border-radius:8px 8px 0 0;border-bottom:1px solid #e5e7eb;width:120px">Título</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${p.ticketTitle}</td>
    </tr>
    <tr>
      <td style="padding:12px 16px;background:#f9fafb;font-weight:600">Prioridad</td>
      <td style="padding:12px 16px;color:${priorityColor};font-weight:700">${p.priority}</td>
    </tr>
  </table>

  <p style="margin:24px 0">
    <a href="${p.appUrl}/postventa/${p.ticketId}" style="background:#0a0a0a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Ver ticket →</a>
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="font-size:12px;color:#9ca3af">CampersNova · Campers Nova S.L · B-22466874</p>
</body>
</html>`
}
