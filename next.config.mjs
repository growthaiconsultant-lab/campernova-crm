import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token para subir source maps (añadir en Vercel env vars)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Sube source maps al build y los elimina del bundle público
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Reduce logs durante el build (verboso solo en CI)
  silent: !process.env.CI,

  telemetry: false,

  hideSourceMaps: true,
})
