interface MatchNotificationProps {
  agentName: string
  score: number
  vehicleSummary: string
  buyerSummary: string
  ctaUrl: string
  ctaLabel: string
}

export function matchNotificationHtml({
  agentName,
  score,
  vehicleSummary,
  buyerSummary,
  ctaUrl,
  ctaLabel,
}: MatchNotificationProps): string {
  // Score color: ≥80 verde, ≥70 teal (umbral mínimo)
  const scoreColor = score >= 80 ? '#15803d' : '#0f766e'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nuevo match · score ${score}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#294e4c;padding:28px 40px;">
              <p style="margin:0 0 2px;color:#a3c4c3;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">CampersNova · Backoffice</p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Nuevo match en tu lead</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 0;">

              <p style="margin:0 0 22px;color:#3f3f46;font-size:15px;">Hola ${escapeHtml(agentName)},</p>

              <!-- Score badge -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color:${scoreColor};color:#ffffff;font-size:32px;font-weight:700;padding:12px 28px;border-radius:8px;text-align:center;">
                          Score ${score}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Vehicle -->
              <p style="margin:0 0 8px;color:#294e4c;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Vehículo</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f6;border:1px solid #d1e0df;border-radius:6px;margin-bottom:18px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;color:#18181b;font-size:15px;font-weight:600;">${escapeHtml(vehicleSummary)}</p>
                  </td>
                </tr>
              </table>

              <!-- Buyer -->
              <p style="margin:0 0 8px;color:#294e4c;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Comprador</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:6px;margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;color:#18181b;font-size:15px;font-weight:600;">${escapeHtml(buyerSummary)}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" style="display:inline-block;background-color:#cc6119;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">${escapeHtml(ctaLabel)} →</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f4f4f5;border-top:1px solid #e4e4e7;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Notificación interna de CampersNova · Recibes este aviso porque eres el agente asignado al lead.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
