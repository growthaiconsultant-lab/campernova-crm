import * as Sentry from '@sentry/nextjs'
import { filterBrowserError } from '@/lib/observability/sentry-browser-event'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  beforeSend(event) {
    return filterBrowserError(event, typeof navigator === 'undefined' ? '' : navigator.userAgent)
  },

  // Capture 10% of traces in production, 100% in dev/staging
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Replay 1% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  debug: false,
})
