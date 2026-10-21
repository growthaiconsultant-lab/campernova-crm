import { randomUUID } from 'node:crypto'
import { QUESTIONS, type SearchAnswers } from '../../lib/search-request/questions'
import { searchRequestSchema } from '../../lib/search-request/schema'

export function searchPayload(full = false) {
  const answers: SearchAnswers = { name: 'Prueba de búsqueda', phone: '+34 600 000 000' }
  if (full)
    for (const q of QUESTIONS) {
      if (q.kind === 'single') answers[q.key] = q.options![0]
      else if (q.kind === 'multi') answers[q.key] = q.options!.slice(0, 2)
      else if (q.kind === 'number') answers[q.key] = String(q.min || 2)
      else if (q.kind === 'date') answers[q.key] = '2027-06-01'
      else if (q.kind === 'email') answers[q.key] = 'prueba@example.invalid'
      else if (!q.required) answers[q.key] = `Respuesta de prueba: ${q.label}`
    }
  return searchRequestSchema.parse({
    requestId: randomUUID(),
    version: '2026-10-21',
    answers,
    consent: true,
    website: '',
  })
}
