export function landingBuyerPayload(eventId = 'buyer-test-event') {
  return {
    nombre: 'Prueba técnica',
    contacto: '600000000',
    gdpr_consent: true,
    web_url: '',
    respuestas: {
      event_id: eventId,
      tipo: 'Aún no lo sé',
      plazas: '1\u00a0o\u00a02',
      presupuesto: 'Más de 80.000 €',
      cuando: 'Más adelante',
      nombre: 'Prueba técnica',
      telefono: '600000000',
      zona: 'Girona',
      financiacion: 'Quiero que me lo expliquéis',
      detalle: 'Escapadas con perro',
      origen: 'utm_campaign=landing',
      pagina: '/encuentra-tu-camper.html',
    },
  }
}
