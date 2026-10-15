import { createRequire } from 'node:module'
import type { ErrorEvent, StackFrame } from '@sentry/nextjs'
import { describe, expect, it } from 'vitest'
import { filterBrowserError } from './sentry-browser-event'

const instagramIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Instagram 451.0.0'
const knownFrames = [
  { filename: 'app:///', lineno: 1, colno: 13836 },
  { filename: 'app:///', function: 'logSubmitButtonClicked', lineno: 1, colno: 5525 },
  { filename: 'app:///', function: 'sendPostMessage', lineno: 1, colno: 4593 },
  { filename: 'app:///', function: 'dispatchToBridge', lineno: 1, colno: 4222 },
]

function knownEvent(): ErrorEvent {
  return {
    type: undefined,
    event_id: 'synthetic-bridge-event',
    exception: {
      values: [
        {
          type: 'InvalidAccessError',
          value: 'The object does not support the operation or argument.',
          stacktrace: { frames: structuredClone(knownFrames) },
        },
      ],
    },
  }
}

describe('OBS-1 Instagram iOS bridge error', () => {
  it('recognises the reported Safari stack through the installed Sentry parser', () => {
    // The Next.js SDK resolves to its Node parser under Vitest. Load the browser
    // parser through the SDK's own dependencies, without adding a second version.
    const requireHere = createRequire(import.meta.url)
    const requireNext = createRequire(requireHere.resolve('@sentry/nextjs'))
    const requireReact = createRequire(requireNext.resolve('@sentry/react'))
    const { defaultStackParser } = requireReact('@sentry/browser') as {
      defaultStackParser: (stack: string) => StackFrame[]
    }
    const event = knownEvent()
    event.exception!.values![0].stacktrace!.frames = defaultStackParser(
      [
        'postMessage@[native code]',
        'dispatchToBridge@app:///:1:4222',
        'sendPostMessage@app:///:1:4593',
        'logSubmitButtonClicked@app:///:1:5525',
        '@app:///:1:13836',
      ].join('\n')
    )
    expect(filterBrowserError(event, instagramIos)).toBeNull()
  })

  it('drops the observed bridge signature even when Sentry marks it in_app', () => {
    const event = knownEvent()
    event.exception!.values![0].stacktrace!.frames!.forEach((frame) => {
      frame.in_app = true
    })
    expect(filterBrowserError(event, instagramIos)).toBeNull()
  })

  it('also accepts the native postMessage frame and unknown line numbers', () => {
    const event = knownEvent()
    const frames = event.exception!.values![0].stacktrace!.frames!
    frames.forEach((frame) => {
      frame.lineno = 7
      frame.colno = 999
    })
    frames.push({ filename: '[native code]', function: 'postMessage' })
    expect(filterBrowserError(event, instagramIos)).toBeNull()
  })

  it.each([
    '',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1',
    'Mozilla/5.0 (Linux; Android 15) Instagram 451.0.0',
    'Mozilla/5.0 Chrome/130.0',
  ])('preserves the original event for a different/missing user-agent: %s', (userAgent) => {
    const event = knownEvent()
    expect(filterBrowserError(event, userAgent)).toBe(event)
  })

  it.each(['TypeError', 'SecurityError', 'Error'])(
    'preserves other exception types: %s',
    (type) => {
      const event = knownEvent()
      event.exception!.values![0].type = type
      expect(filterBrowserError(event, instagramIos)).toBe(event)
    }
  )

  it('preserves the same exception type with another message', () => {
    const event = knownEvent()
    event.exception!.values![0].value = 'A different invalid access failure'
    expect(filterBrowserError(event, instagramIos)).toBe(event)
  })

  it.each([
    {
      filename: 'https://campersnova.com/_next/static/chunks/app/vender/empezar/page.js',
      function: 'handleSubmit',
    },
    { filename: 'app:///', function: 'submitPublicLead' },
    { filename: 'https://js.hcaptcha.com/1/api.js', function: 'dispatchToBridge' },
    { filename: '[native code]', function: 'someOtherOperation' },
    { function: 'postMessage' },
  ])('preserves mixed or unrecognised frames: %j', (frame) => {
    const event = knownEvent()
    event.exception!.values![0].stacktrace!.frames!.push(frame)
    expect(filterBrowserError(event, instagramIos)).toBe(event)
  })

  it.each(['dispatchToBridge', 'sendPostMessage', 'logSubmitButtonClicked'])(
    'preserves incomplete signatures missing %s',
    (name) => {
      const event = knownEvent()
      event.exception!.values![0].stacktrace!.frames = knownFrames.filter(
        (frame) => frame.function !== name
      )
      expect(filterBrowserError(event, instagramIos)).toBe(event)
    }
  )

  it('preserves an exception chain even if one error matches', () => {
    const event = knownEvent()
    event.exception!.values!.push({ type: 'TypeError', value: 'Application failure' })
    expect(filterBrowserError(event, instagramIos)).toBe(event)
  })

  it.each([
    { type: undefined },
    { type: undefined, exception: { values: [] } },
    { type: undefined, exception: { values: [{ type: 'InvalidAccessError' }] } },
  ] satisfies ErrorEvent[])('preserves incomplete events without modifying them', (event) => {
    const before = structuredClone(event)
    expect(filterBrowserError(event, instagramIos)).toBe(event)
    expect(event).toEqual(before)
  })

  it('does not mutate a matching event', () => {
    const event = knownEvent()
    const before = structuredClone(event)
    filterBrowserError(event, instagramIos)
    expect(event).toEqual(before)
  })
})
