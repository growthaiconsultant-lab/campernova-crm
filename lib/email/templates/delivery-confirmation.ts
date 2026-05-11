interface DeliveryConfirmationParams {
  buyerName: string
  vehicleLabel: string
  scheduledAt: Date
  deliveryId: string
  appUrl: string
}

export function deliveryConfirmationHtml(p: DeliveryConfirmationParams): string {
  const date = p.scheduledAt.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const time = p.scheduledAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Confirmación de entrega</title></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="font-size:22px;margin-bottom:4px">¡Tu entrega está confirmada!</h1>
  <p style="color:#666;margin-top:0">Hola ${p.buyerName}, te esperamos en la nave.</p>

  <table style="width:100%;border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse;margin:24px 0">
    <tr><td style="padding:12px 16px;background:#f9fafb;font-weight:600;border-radius:8px 8px 0 0;border-bottom:1px solid #e5e7eb">Vehículo</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${p.vehicleLabel}</td></tr>
    <tr><td style="padding:12px 16px;background:#f9fafb;font-weight:600;border-bottom:1px solid #e5e7eb">Fecha</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${date}</td></tr>
    <tr><td style="padding:12px 16px;background:#f9fafb;font-weight:600;border-bottom:1px solid #e5e7eb">Hora</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${time}</td></tr>
    <tr><td style="padding:12px 16px;background:#f9fafb;font-weight:600">Dónde</td><td style="padding:12px 16px">Carrer Torre de Cellers, 08150 Barcelona</td></tr>
  </table>

  <p style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;margin:0">
    <strong>Recuerda traer tu DNI</strong> — lo necesitaremos para completar la firma del contrato.
  </p>

  <p style="margin-top:24px">Si tienes alguna duda llámanos al <a href="tel:+34645639185">645 63 91 85</a> o escríbenos por <a href="https://wa.me/34645639185">WhatsApp</a>.</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="font-size:12px;color:#9ca3af">CampersNova · Campers Nova S.L · B-22466874 · Carrer Torre de Cellers, 08150 Barcelona</p>
</body>
</html>`
}
