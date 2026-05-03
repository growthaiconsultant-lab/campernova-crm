interface SellerLeadConfirmationProps {
  sellerName: string
  brand: string
  model: string
  year: number
  km: number
  valuation?: { min: number; recommended: number; max: number } | null
}

export function sellerLeadConfirmationHtml({
  sellerName,
  brand,
  model,
  year,
  km,
  valuation,
}: SellerLeadConfirmationProps): string {
  const hasValuation = valuation && valuation.recommended > 0
  const firstName = sellerName.split(' ')[0]

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hemos recibido tu solicitud</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#294e4c;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">CampersNova</h1>
              <p style="margin:4px 0 0;color:#a3c4c3;font-size:13px;">Especialistas en autocaravanas y campers</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">

              <p style="margin:0 0 16px;color:#18181b;font-size:16px;">Hola <strong>${escapeHtml(firstName)}</strong>,</p>

              <p style="margin:0 0 24px;color:#3f3f46;font-size:15px;line-height:1.6;">
                Hemos recibido tu solicitud de venta. Nuestro equipo la revisará y se pondrá en contacto contigo en las próximas <strong>24–48 horas</strong>.
              </p>

              <!-- Vehicle card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f6;border:1px solid #d1e0df;border-radius:6px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;color:#294e4c;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Tu vehículo</p>
                    <p style="margin:0 0 4px;color:#18181b;font-size:20px;font-weight:700;">${escapeHtml(brand)} ${escapeHtml(model)}</p>
                    <p style="margin:0;color:#71717a;font-size:14px;">${year} &nbsp;·&nbsp; ${km.toLocaleString('es-ES')} km</p>
                  </td>
                </tr>
              </table>

              <!-- Estimated value -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed;border:1px solid #fdba74;border-radius:6px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#9a3412;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Tasación preliminar</p>
                    ${
                      hasValuation
                        ? `
                    <p style="margin:0 0 6px;color:#7c2d12;font-size:22px;font-weight:700;">
                      ${valuation!.min.toLocaleString('es-ES')} € – ${valuation!.max.toLocaleString('es-ES')} €
                    </p>
                    <p style="margin:0 0 4px;color:#c2410c;font-size:14px;">
                      Precio recomendado: <strong>${valuation!.recommended.toLocaleString('es-ES')} €</strong>
                    </p>
                    <p style="margin:0;color:#c2410c;font-size:13px;line-height:1.5;">
                      Rango orientativo calculado automáticamente. Tu agente lo confirmará en las próximas 24 h.
                    </p>
                    `
                        : `
                    <p style="margin:0 0 6px;color:#7c2d12;font-size:22px;font-weight:700;">En preparación</p>
                    <p style="margin:0;color:#c2410c;font-size:13px;line-height:1.5;">
                      Revisaremos las características de tu vehículo y te haremos llegar una tasación personalizada junto a nuestra respuesta.
                    </p>
                    `
                    }
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#3f3f46;font-size:14px;line-height:1.6;">
                ¿Tienes alguna pregunta? Responde a este email o escríbenos a
                <a href="mailto:info@campersnova.com" style="color:#294e4c;text-decoration:underline;">info@campersnova.com</a>.
              </p>

              <p style="margin:24px 0 0;color:#3f3f46;font-size:15px;">
                Hasta pronto,<br />
                <strong style="color:#18181b;">El equipo de CampersNova</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f4f4f5;border-top:1px solid #e4e4e7;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;color:#a1a1aa;font-size:12px;">
                © ${new Date().getFullYear()} CampersNova · <a href="https://campersnova.com" style="color:#a1a1aa;text-decoration:underline;">campersnova.com</a>
              </p>
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                Recibes este email porque enviaste una solicitud de venta en campersnova.com.
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
