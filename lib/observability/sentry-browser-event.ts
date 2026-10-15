import type { ErrorEvent } from '@sentry/nextjs'

const BRIDGE_FUNCTIONS = ['dispatchToBridge', 'sendPostMessage', 'logSubmitButtonClicked']
const BRIDGE_ERROR_MESSAGE = 'The object does not support the operation or argument.'

/**
 * CAMPERNOVA-CRM-1K: Instagram's iOS bridge rejects its submit-click telemetry.
 * Keep incomplete or mixed stacks so errors from our application remain visible.
 */
export function filterBrowserError(event: ErrorEvent, userAgent: string): ErrorEvent | null {
  if (!/\bInstagram\b/.test(userAgent) || !/\b(iPhone|iPad|iPod)\b/.test(userAgent)) {
    return event
  }

  const exceptions = event.exception?.values
  if (exceptions?.length !== 1) return event

  const exception = exceptions[0]
  if (exception.type !== 'InvalidAccessError' || exception.value !== BRIDGE_ERROR_MESSAGE) {
    return event
  }

  const frames = exception.stacktrace?.frames
  if (!frames?.length) return event

  const bridgeFrames = frames.filter((frame) => frame.filename === 'app:///')
  if (!BRIDGE_FUNCTIONS.every((name) => bridgeFrames.some((frame) => frame.function === name))) {
    return event
  }

  const onlyKnownFrames = frames.every((frame) => {
    if (frame.filename === '[native code]' && frame.function === 'postMessage') return true
    return (
      frame.filename === 'app:///' &&
      (!frame.function || frame.function === '?' || BRIDGE_FUNCTIONS.includes(frame.function))
    )
  })

  return onlyKnownFrames ? null : event
}
