import { describe, expect, it } from 'vitest'
import { searchPayload } from '@/tests/fixtures/search-request'
import { searchRequestSummary } from './intake'
import { QUESTIONS } from './questions'
import { formatSearchAnswer, isSearchRequestLead, readSearchSnapshot } from './presentation'

describe('search request presentation of existing snapshots', () => {
  it('identifies the immutable intake ID without relying on editable Web/New fields', () => {
    expect(isSearchRequestLead('search_request_' + 'a'.repeat(40))).toBe(true)
    for (const id of [
      'buyer1',
      'landing_buyer_' + 'a'.repeat(40),
      'search_request_',
      'search_request_' + 'g'.repeat(40),
    ])
      expect(isSearchRequestLead(id)).toBe(false)
  })
  it('recovers every answer from the actual serializer, including multiline values', () => {
    const input = searchPayload(true)
    input.answers.comments =
      'Primera línea\n\nSegunda línea: ejemplo\nhttps://example.invalid/referencia'
    const sections = readSearchSnapshot(searchRequestSummary(input))!
    const rows = sections.flatMap((section) => section.rows)
    expect(rows).toHaveLength(QUESTIONS.length)
    for (const question of QUESTIONS) {
      const value = input.answers[question.key]
      expect(rows.find((row) => row.key === question.key)?.value).toBe(
        Array.isArray(value) ? value.join(' · ') : value
      )
    }
    expect(readSearchSnapshot(searchRequestSummary(input).replace(/\n/g, '\r\n'))).toEqual(sections)
  })
  it('distinguishes unanswered questions from exact zero', () => {
    const input = searchPayload()
    input.answers.children = '0'
    const rows = readSearchSnapshot(searchRequestSummary(input))!.flatMap((section) => section.rows)
    expect(rows.find((row) => row.key === 'children')).toMatchObject({ value: '0', provided: true })
    expect(rows.find((row) => row.key === 'budget')).toMatchObject({ provided: false })
  })
  it('formats money, dates and units without changing free text', () => {
    const input = searchPayload(true)
    Object.assign(input.answers, {
      budget: '25000',
      budgetLimit: '35000',
      maxKm: '125000',
      minInteriorHeight: '1.95',
      minYear: '2019',
    })
    const rows = readSearchSnapshot(searchRequestSummary(input))!.flatMap((section) => section.rows)
    const display = (key: string) =>
      formatSearchAnswer(rows.find((row) => row.key === key)!).replace(/\u00a0/g, ' ')
    expect(display('budget')).toBe('25.000 €')
    expect(display('budgetLimit')).toBe('35.000 €')
    expect(display('deliveryDate')).toBe('01/06/2027')
    expect(display('maxKm')).toBe('125.000 km')
    expect(display('minInteriorHeight')).toBe('1,95 m')
    expect(display('minYear')).toBe('2019')
    expect(display('comments')).toBe(input.answers.comments)
  })
  it('falls back rather than dropping ambiguous, reordered or unknown content', () => {
    const input = searchPayload()
    const original = searchRequestSummary(input)
    for (const content of [
      null,
      '',
      'Una ficha antigua',
      original.replace('Nombre y apellidos: ', 'Nombre antiguo: '),
      original.replace('PRESUPUESTO\n', 'PRESUPUESTO\nDato no reconocido\n'),
    ])
      expect(readSearchSnapshot(content)).toBeNull()
    input.answers.comments = 'Una nota\nRequisito imprescindible 1: texto que imita una pregunta'
    expect(readSearchSnapshot(searchRequestSummary(input))).toBeNull()
    input.answers.comments = 'Una nota\nPRESUPUESTO\nOtra nota'
    expect(readSearchSnapshot(searchRequestSummary(input))).toBeNull()
  })
})
