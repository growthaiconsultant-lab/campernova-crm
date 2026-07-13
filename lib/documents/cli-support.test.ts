import { describe, it, expect } from 'vitest'
import { parseCliFlags, readEnvSelector, contentHash } from './cli-support'

describe('parseCliFlags', () => {
  it('parsea --flag value, --flag=value y --flag booleano', () => {
    const f = parseCliFlags(['--env', 'staging', '--apply', '--batch-size=100', 'positional'])
    expect(f.env).toBe('staging')
    expect(f.apply).toBe(true)
    expect(f['batch-size']).toBe('100')
  })
  it('--flag seguido de otro --flag es booleano', () => {
    const f = parseCliFlags(['--dry-run', '--env', 'local'])
    expect(f['dry-run']).toBe(true)
    expect(f.env).toBe('local')
  })
})

describe('readEnvSelector', () => {
  it('local por defecto', () => {
    expect(readEnvSelector({})).toBe('local')
  })
  it('acepta staging/production', () => {
    expect(readEnvSelector({ env: 'staging' })).toBe('staging')
    expect(readEnvSelector({ env: 'production' })).toBe('production')
  })
  it('rechaza un env inválido', () => {
    expect(() => readEnvSelector({ env: 'prod' })).toThrow()
  })
})

describe('contentHash', () => {
  it('es determinista', () => {
    expect(contentHash({ a: 1 })).toBe(contentHash({ a: 1 }))
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }))
  })
})
