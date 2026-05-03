interface AgentLeadNotificationProps {
  leadId: string
  sellerName: string
  sellerEmail: string
  sellerPhone: string
  canal: string
  brand: string
  model: string
  year: number
  km: number
  vehicleType: string
  location: string | null
  desiredPrice: string | null
  conservationState: string
  appUrl: string
}

export function agentLeadNotificationHtml({
  leadId,
  sellerName,
  sellerEmail,
  sellerPhone,
  canal,
  brand,
  model,
  year,
  km,
  vehicleType,
  location,
  desiredPrice,
  conservationState,
  appUrl,
}: AgentLeadNotificationProps): string {
  const fichaUrl = `${appUrl}/vendedores/${leadId}`
  const canalLabel = canal === 'PRO' ? 'Web pública (/vender)' : 'Backoffice (CN)'
  const conservationLabel: Record<string, string> = {
    EXCELENTE: 'Excelente',
    MUY_BUENO: 'Muy bueno',
    BUENO: 'Bueno',
    NORMAL: 'Normal',
    DETERIORADO: 'Deteriorado',
  }
  const vehicleTypeLabel: Record<string, string> = {
    AUTOCARAVANA: 'Autocaravana',
    CAMPER: 'Camper',
    FURGONETA: 'Furgoneta',
    OTRO: 'Otro',
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nuevo lead — ${escapeHtml(brand)} ${escapeHtml(model)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#294e4c;padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 2px;color:#a3c4c3;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">CampersNova · Backoffice</p>
                    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Nuevo lead de venta</h1>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background-color:#cc6119;color:#ffffff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(canalLabel)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 0;">

              <!-- Vehicle -->
              <p style="margin:0 0 10px;color:#294e4c;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Vehículo</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f6;border:1px solid #d1e0df;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 22px;">
                    <p style="margin:0 0 2px;color:#18181b;font-size:20px;font-weight:700;">${escapeHtml(brand)} ${escapeHtml(model)}</p>
                    <p style="margin:0 0 12px;color:#71717a;font-size:14px;">${vehicleTypeLabel[vehicleType] ?? vehicleType} &nbsp;·&nbsp; ${year} &nbsp;·&nbsp; ${km.toLocaleString('es-ES')} km</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:24px;">
                          <p style="margin:0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Estado</p>
                          <p style="margin:2px 0 0;color:#18181b;font-size:14px;font-weight:600;">${conservationLabel[conservationState] ?? conservationState}</p>
                        </td>
                        ${
                          location
                            ? `<td style="padding-right:24px;">
                          <p style="margin:0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Ubicación</p>
                          <p style="margin:2px 0 0;color:#18181b;font-size:14px;font-weight:600;">${escapeHtml(location)}</p>
                        </td>`
                            : ''
                        }
                        ${
                          desiredPrice
                            ? `<td>
                          <p style="margin:0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Precio deseado</p>
                          <p style="margin:2px 0 0;color:#cc6119;font-size:14px;font-weight:700;">${escapeHtml(desiredPrice)} €</p>
                        </td>`
                            : ''
                        }
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Seller -->
              <p style="margin:0 0 10px;color:#294e4c;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Vendedor</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:6px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 22px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:10px;">
                          <p style="margin:0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Nombre</p>
                          <p style="margin:2px 0 0;color:#18181b;font-size:15px;font-weight:600;">${escapeHtml(sellerName)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:10px;">
                          <p style="margin:0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Email</p>
                          <p style="margin:2px 0 0;font-size:14px;">
                            <a href="mailto:${escapeHtml(sellerEmail)}" style="color:#294e4c;text-decoration:underline;">${escapeHtml(sellerEmail)}</a>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin:0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Teléfono</p>
                          <p style="margin:2px 0 0;font-size:14px;">
                            <a href="tel:${escapeHtml(sellerPhone)}" style="color:#294e4c;text-decoration:underline;">${escapeHtml(sellerPhone)}</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${fichaUrl}" style="display:inline-block;background-color:#294e4c;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">Ver ficha del lead →</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f4f4f5;border-top:1px solid #e4e4e7;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Notificación interna de CampersNova · <a href="${fichaUrl}" style="color:#a1a1aa;text-decoration:underline;">Abrir ficha</a>
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
