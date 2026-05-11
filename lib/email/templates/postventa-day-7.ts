interface PostventaDay7Params {
  buyerName: string
  vehicleLabel: string
  appUrl: string
}

export function postventaDay7Html(p: PostventaDay7Params): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>¿Qué tal la primera semana?</title></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="font-size:22px">¿Qué tal va tu ${p.vehicleLabel}?</h1>
  <p>Hola ${p.buyerName},</p>
  <p>Ya ha pasado una semana desde que te fuiste con tu camper. ¿Todo bien? ¿Alguna duda con el boiler, las placas o la calefacción?</p>
  <p>Estamos aquí para lo que necesites — responde a este email o llámanos al <a href="tel:+34645639185">645 63 91 85</a>.</p>
  <p style="margin-top:32px">
    <a href="${p.appUrl}/contacto" style="background:#0a0a0a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Contactar con CampersNova →</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="font-size:12px;color:#9ca3af">CampersNova · Campers Nova S.L · B-22466874</p>
</body>
</html>`
}
