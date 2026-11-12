type OwnerQuoteEmail = {
  ownerName: string | null
  vehicleLabel: string | null
  total: string
  version: number
  link: string
}

const logoId = 'campersnova-taller-logo'
const contact = 'info@campersnova.com'

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!
  )
}

export function ownerQuoteEmail({
  ownerName,
  vehicleLabel,
  total,
  version,
  link,
}: OwnerQuoteEmail) {
  const greeting = ownerName?.trim() ? `Hola, ${ownerName.trim()}.` : 'Hola,'
  const vehicle = vehicleLabel?.trim() || 'Tu vehículo'
  const intro =
    'Hemos revisado tu vehículo y preparado el presupuesto de las reparaciones que recomendamos.'
  const guidance =
    'En tu enlace privado puedes consultar cada trabajo y su precio, y aceptar o rechazar el presupuesto.'
  const text = [
    'CampersNova · Taller',
    greeting,
    intro,
    `${vehicle}\nVersión ${version}\nTotal con IVA: ${total}`,
    guidance,
    link,
    `Si tienes alguna duda, escríbenos a ${contact}.\nEl equipo de taller de CampersNova`,
  ].join('\n\n')
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tu presupuesto de reparaciones</title></head>
<body style="margin:0;padding:0;background-color:#f6f2e8;color:#1d352b;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f2e8">
    <tr><td align="center" style="padding:20px 10px">
      <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:560px;border:1px solid #e6dfd0;border-radius:12px;overflow:hidden">
        <tr><td bgcolor="#1d352b" style="padding:22px 24px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td><img src="cid:${logoId}" width="116" height="51" alt="CampersNova" style="display:block;border:0;color:#f6f2e8;font-size:18px"></td>
            <td align="right" style="color:#f6f2e8;font-size:14px">Taller</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px 24px 24px">
          <h1 style="margin:0 0 20px;color:#1d352b;font:normal 30px/1.15 Georgia,serif">Tu presupuesto de reparaciones</h1>
          <p style="margin:0 0 8px;color:#2a2622;font-size:16px;line-height:24px">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 20px;color:#2a2622;font-size:16px;line-height:24px">${intro}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f2e8" style="border-radius:8px">
            <tr><td style="padding:16px 18px 0;color:#625748;font-size:13px">Vehículo · Versión ${version}</td></tr>
            <tr><td style="padding:4px 18px 14px;color:#1d352b;font-size:19px;font-weight:bold">${escapeHtml(vehicle)}</td></tr>
            <tr><td style="padding:12px 18px 16px;border-top:1px solid #ded6c6;color:#1d352b;font-size:15px">Total con IVA&nbsp;&nbsp; <strong style="font-size:22px">${escapeHtml(total)}</strong></td></tr>
          </table>
          <p style="margin:20px 0 16px;color:#2a2622;font-size:16px;line-height:24px">${guidance}</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#2e5e59" style="border-radius:6px;mso-padding-alt:14px 20px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 20px;color:#ffffff;font:bold 16px/20px Arial,sans-serif;text-decoration:none">Revisar presupuesto</a></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:18px 24px;border-top:1px solid #e6dfd0;color:#514b43;font-size:14px;line-height:21px">
          <strong style="color:#1d352b">El equipo de taller de CampersNova</strong><br>
          ¿Tienes alguna duda? Escríbenos a <a href="mailto:${contact}" style="color:#2e5e59">${contact}</a>.
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body></html>`
  return {
    html,
    text,
    attachments: [
      {
        filename: 'CampersNova.png',
        path: 'https://campersnova.com/cn-landing/img/logo-cn-crema.png',
        contentType: 'image/png',
        contentId: logoId,
      },
    ],
  }
}
