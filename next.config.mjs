import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/encuentra-tu-camper', destination: '/encuentra-tu-camper.html' },
      { source: '/vende-tu-camper', destination: '/vende-tu-camper.html' },
    ]
  },
  // Adjuntos operativos de hasta 3 MiB más multipart, bajo el límite de Vercel (4,5 MB).
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
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

  // Sube source maps al build y los elimina del bundle público
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Reduce logs durante el build (verboso solo en CI)
  silent: !process.env.CI,

  telemetry: false,

  hideSourceMaps: true,
})
