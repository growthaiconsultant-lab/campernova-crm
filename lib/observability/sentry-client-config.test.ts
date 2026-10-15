import type { ErrorEvent } from '@sentry/nextjs'
import * as Sentry from '@sentry/nextjs'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  replayIntegration: vi.fn(() => ({ name: 'Replay' })),
}))

afterEach(() => vi.unstubAllGlobals())

describe('OBS-1 Sentry client configuration', () => {
  it('wires beforeSend using the current user-agent and preserves Replay privacy/settings', async () => {
    await import('../../sentry.client.config')
    const options = vi.mocked(Sentry.init).mock.calls[0][0]!
    expect(options.beforeSend).toBeTypeOf('function')
    expect(options).toMatchObject({ replaysSessionSampleRate: 0.01, replaysOnErrorSampleRate: 1 })
    expect(Sentry.replayIntegration).toHaveBeenCalledWith({
      maskAllText: true,
      blockAllMedia: true,
    })

    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [
          {
            type: 'InvalidAccessError',
            value: 'The object does not support the operation or argument.',
            stacktrace: {
              frames: [
                { filename: 'app:///', function: 'dispatchToBridge' },
                { filename: 'app:///', function: 'sendPostMessage' },
                { filename: 'app:///', function: 'logSubmitButtonClicked' },
              ],
            },
          },
        ],
      },
    }

    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone) Instagram 451.0.0' })
    expect(options.beforeSend!(event, {})).toBeNull()
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone) Safari/604.1' })
    expect(options.beforeSend!(event, {})).toBe(event)
    vi.stubGlobal('navigator', undefined)
    expect(options.beforeSend!(event, {})).toBe(event)
  })
})
