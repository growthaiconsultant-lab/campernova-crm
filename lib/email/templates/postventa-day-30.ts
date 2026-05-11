interface PostventaDay30Params {
  buyerName: string
  vehicleLabel: string
  appUrl: string
}

export function postventaDay30Html(p: PostventaDay30Params): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Un mes con tu camper</title></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="font-size:22px">¡Un mes ya con tu ${p.vehicleLabel}!</h1>
  <p>Hola ${p.buyerName},</p>
  <p>Ha pasado un mes desde que te entregamos tu camper. Esperamos que hayas podido hacer alguna escapada.</p>
  <p>Si estás contento, una reseña en Google nos ayudaría un montón a llegar a más viajeros como tú:</p>
  <p style="margin:24px 0">
    <a href="https://g.page/r/campersnova" style="background:#0a0a0a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Dejar reseña en Google →</a>
  </p>
  <p>Y si tienes cualquier duda o incidencia, responde a este email o llámanos al <a href="tel:+34645639185">645 63 91 85</a>.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="font-size:12px;color:#9ca3af">CampersNova · Campers Nova S.L · B-22466874</p>
</body>
</html>`
}
