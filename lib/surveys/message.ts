export const surveyEmailSubject = '¿Cómo fue tu experiencia con CampersNova?'

export function surveyInvitationMessage(url: string): string {
  return [
    'Hola, somos CampersNova.',
    'Nos gustaría saber cómo fue tu experiencia. ¿Nos dedicas dos minutos para responder a esta encuesta?',
    url,
    'Gracias por ayudarnos a mejorar.',
  ].join('\n\n')
}
