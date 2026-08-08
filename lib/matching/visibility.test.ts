import { describe, expect, it } from 'vitest'
import { shouldShowPersistedMatch } from './visibility'

describe('shouldShowPersistedMatch', () => {
  it('muestra una sugerencia automática mientras es elegible', () => {
    expect(shouldShowPersistedMatch({ generatedBy: 'auto', manualLinkedAt: null }, true)).toBe(true)
  })

  it('oculta una sugerencia automática histórica que ya no es elegible', () => {
    expect(shouldShowPersistedMatch({ generatedBy: 'auto', manualLinkedAt: null }, false)).toBe(
      false
    )
  })

  it('conserva una relación fijada manualmente aunque deje de ser elegible', () => {
    expect(
      shouldShowPersistedMatch(
        { generatedBy: 'auto', manualLinkedAt: new Date('2026-08-08') },
        false
      )
    ).toBe(true)
  })

  it('conserva un match manual legacy sin metadata REL-1', () => {
    expect(shouldShowPersistedMatch({ generatedBy: 'manual', manualLinkedAt: null }, false)).toBe(
      true
    )
  })
})
