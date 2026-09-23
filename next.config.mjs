import { withSentryConfig } from '@sentry/nextjs'
import { observabilityEnvironment } from './lib/observability-environment.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_OBSERVABILITY_ENV: observabilityEnvironment(
      process.env.VERCEL_ENV,
      process.env.NODE_ENV
    ),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Las redirecciones 301 del WordPress antiguo se resuelven en `middleware.ts`
  // (corre antes que redirects() de next.config). Ver lib/legacy-redirects.ts
  // y docs/migration/README.md.
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token para subir source maps (añadir en Vercel env vars)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,

  // Sube source maps al build y los elimina del bundle público
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Reduce logs durante el build (verboso solo en CI)
  silent: !process.env.CI,

  telemetry: false,

  hideSourceMaps: true,
})
