export const surveyEmailSubject = '¿Cómo fue tu experiencia con CampersNova?'

export function surveyInvitationMessage(url: string): string {
  return [
    'Hola, somos CampersNova.',
    'Nos gustaría saber cómo fue tu experiencia. ¿Nos dedicas dos minutos para responder a esta encuesta?',
    'Abre tu enlace personal y confirma el correo o el teléfono de tu ficha para responder.',
    url,
    'Gracias por ayudarnos a mejorar.',
  ].join('\n\n')
}
