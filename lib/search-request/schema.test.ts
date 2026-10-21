import { describe, expect, it } from 'vitest'
import { searchPayload } from '@/tests/fixtures/search-request'
import { searchRequestSchema } from './schema'
import { searchRequestSummary } from './intake'
import { QUESTIONS } from './questions'

describe('revised search questionnaire', () => {
  it('accepts contact-only and complete answers without dropping fields', () => {
    expect(searchRequestSchema.parse(searchPayload()).answers).toEqual({
      name: 'Prueba de búsqueda',
      phone: '+34 600 000 000',
    })
    const full = searchPayload(true)
    expect(Object.keys(full.answers)).toHaveLength(QUESTIONS.length)
    for (const question of QUESTIONS)
      expect(searchRequestSummary(full)).toContain(`${question.label}:`)
  })
  it.each(['name', 'phone'])('requires %s', (key) => {
    const input = searchPayload()
    delete input.answers[key]
    expect(searchRequestSchema.safeParse(input).success).toBe(false)
    input.answers[key] = '   '
    expect(searchRequestSchema.safeParse(input).success).toBe(false)
  })
  it.each([
    { phone: 'llámame' },
    { email: 'invalid' },
    { seats: '-1' },
    { seats: '2.5' },
    { budget: 'Infinity' },
    { budget: '5e4' },
    { minInteriorHeight: '10' },
    { deliveryDate: '2027-02-30' },
    { beds: ['Literas', 'Literas'] },
    { beds: ['inventado'] },
    { engine: 'x'.repeat(301) },
    { comments: 'x'.repeat(2001) },
    { license: 'B' },
    { parkingLength: '6' },
    { budget: '65000', budgetLimit: '50000' },
    { deliveryDate: '2027-06-01', deadline: '2027-05-01' },
  ])('rejects invalid or removed question %j', (answers) => {
    const input = searchPayload()
    expect(
      searchRequestSchema.safeParse({ ...input, answers: { ...input.answers, ...answers } }).success
    ).toBe(false)
  })
  it('rejects missing consent, honeypot, forged agent, unknown top-level keys and bad identity', () => {
    for (const extra of [
      { consent: false },
      { website: 'bot' },
      { agentId: 'forged' },
      { requestId: 'guessable' },
    ]) {
      expect(searchRequestSchema.safeParse({ ...searchPayload(), ...extra }).success).toBe(false)
    }
  })
  it('permits deliberately blank optional values and exact zero', () => {
    const input = searchPayload()
    expect(
      searchRequestSchema.parse({
        ...input,
        answers: { ...input.answers, children: '0', budget: '', email: '', beds: [] },
      }).answers.children
    ).toBe('0')
  })
})
