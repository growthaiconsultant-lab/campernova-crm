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

  // ── Redirecciones 301 desde el WordPress antiguo (migración SEO) ──────────────
  // Preservan el posicionamiento al conectar el dominio campersnova.com a esta app.
  // Ver docs/migration/README.md para el detalle. Las rutas idénticas
  // (/, /contacto, /aviso-legal) no necesitan redirect; Next maneja el trailing slash.
  async redirects() {
    const toComprar = (source) => ({ source, destination: '/comprar', permanent: true })
    return [
      // Páginas que cambian de slug
      { source: '/tasacion', destination: '/vender', permanent: true },
      { source: '/gestion-de-venta', destination: '/vender', permanent: true },
      { source: '/politica-de-cookies', destination: '/cookies', permanent: true },
      { source: '/privacy-policy', destination: '/privacidad', permanent: true },
      // Catálogo / carrito WooCommerce → flujo de compra
      { source: '/cars', destination: '/comprar', permanent: true },
      { source: '/carrito', destination: '/comprar', permanent: true },
      // Fichas de vehículo del WP (42) → catálogo (sin equivalente 1:1 todavía)
      toComprar('/listings'),
      { source: '/listings/:slug*', destination: '/comprar', permanent: true },
      // Productos demo WooCommerce → catálogo
      { source: '/producto/:slug*', destination: '/comprar', permanent: true },
      { source: '/categoria-producto/:slug*', destination: '/comprar', permanent: true },
    ]
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
