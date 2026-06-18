import { describe, it, expect } from 'vitest'
import { resolveAnthropicBaseURL } from './anthropic'

describe('resolveAnthropicBaseURL', () => {
  it('devuelve undefined si no hay variable (usa el default del SDK)', () => {
    expect(resolveAnthropicBaseURL(undefined)).toBeUndefined()
    expect(resolveAnthropicBaseURL('')).toBeUndefined()
    expect(resolveAnthropicBaseURL('   ')).toBeUndefined()
  })

  it('añade /v1 cuando falta (el bug que rompía el chat en local)', () => {
    expect(resolveAnthropicBaseURL('https://api.anthropic.com')).toBe(
      'https://api.anthropic.com/v1'
    )
    expect(resolveAnthropicBaseURL('https://api.anthropic.com/')).toBe(
      'https://api.anthropic.com/v1'
    )
  })

  it('respeta una base URL que ya incluye /vN', () => {
    expect(resolveAnthropicBaseURL('https://api.anthropic.com/v1')).toBe(
      'https://api.anthropic.com/v1'
    )
    expect(resolveAnthropicBaseURL('https://api.anthropic.com/v1/')).toBe(
      'https://api.anthropic.com/v1'
    )
    expect(resolveAnthropicBaseURL('https://api.anthropic.com/v2')).toBe(
      'https://api.anthropic.com/v2'
    )
  })

  it('normaliza un gateway/proxy intermedio añadiendo /v1', () => {
    expect(resolveAnthropicBaseURL('https://gateway.example.com/anthropic')).toBe(
      'https://gateway.example.com/anthropic/v1'
    )
  })
})
