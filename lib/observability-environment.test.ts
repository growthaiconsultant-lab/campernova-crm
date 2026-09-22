import { afterEach, describe, expect, it, vi } from 'vitest'
import { observabilityEnvironment } from './observability-environment.mjs'

vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  replayIntegration: vi.fn(() => 'masked-replay'),
  withSentryConfig: vi.fn((config, options) => ({ config, options })),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  vi.resetModules()
})

describe('Sentry environment and private source maps', () => {
  it.each([
    ['preview', 'production', 'preview'],
    ['production', 'production', 'production'],
    ['development', 'production', 'development'],
    [undefined, 'test', 'test'],
    [undefined, undefined, 'development'],
    ['unexpected', 'production', 'production'],
  ])('labels %s / %s as %s', (vercel, node, expected) => {
    expect(observabilityEnvironment(vercel, node)).toBe(expected)
  })

  it('injects the same non-secret Preview label at build time and expands private map uploads', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    const { default: wrapped } = await import('../next.config.mjs')
    // The Sentry wrapper is replaced above to inspect its public configuration inputs.
    const { withSentryConfig } = await import('@sentry/nextjs')
    expect(wrapped).toBeDefined()
    expect(withSentryConfig).toHaveBeenCalledWith(
      expect.objectContaining({ env: { NEXT_PUBLIC_OBSERVABILITY_ENV: 'preview' } }),
      expect.objectContaining({
        widenClientFileUpload: true,
        sourcemaps: { deleteSourcemapsAfterUpload: true },
        hideSourceMaps: true,
      })
    )
  })

  it('uses the injected environment in all three runtimes without changing replay privacy', async () => {
    vi.stubEnv('NEXT_PUBLIC_OBSERVABILITY_ENV', 'preview')
    const { init, replayIntegration } = await import('@sentry/nextjs')
    await import('../sentry.client.config')
    await import('../sentry.server.config')
    await import('../sentry.edge.config')
    expect(init).toHaveBeenCalledTimes(3)
    for (const [options] of vi.mocked(init).mock.calls) {
      expect(options?.environment).toBe('preview')
      expect(options).not.toHaveProperty('ignoreErrors')
      expect(options).not.toHaveProperty('beforeSend')
    }
    expect(replayIntegration).toHaveBeenCalledWith({ maskAllText: true, blockAllMedia: true })
  })
})
