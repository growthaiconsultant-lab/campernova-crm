export function landingPayload(eventId = 'cn-test-event') {
  return {
    nombre: 'Prueba técnica',
    contacto: '600000000',
    gdpr_consent: true,
    web_url: '',
    respuestas: {
      event_id: eventId,
      tipo: 'Camper / furgoneta camperizada',
      modelo: 'Volkswagen California Ocean',
      anio: '2019',
      km: '85.000',
      prioridad: 'Solo saber cuánto vale',
      busca_otra: 'No',
      nombre: 'Prueba técnica',
      telefono: '600000000',
      zona: 'Sabadell',
      origen: 'utm_source=prueba · utm_campaign=landing',
      pagina: '/vende-tu-camper.html',
    },
  }
}
