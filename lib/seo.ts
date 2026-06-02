/**
 * Configuración SEO central del sitio público.
 * `SITE_URL` se usa para metadataBase, canonicals, sitemap y robots.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://campersnova.com'
).trim()

export const SITE_NAME = 'CampersNova'
export const SITE_LEGAL_NAME = 'Campers Nova S.L'

export const SITE_DESCRIPTION =
  'Compra y vende autocaravanas y campers seminuevas con garantía. En CampersNova custodiamos, preparamos y vendemos tu vehículo en depósito: taller propio, garantía de 12 meses ampliable, financiación y cambio de nombre incluido.'

export const SITE_KEYWORDS = [
  'autocaravanas seminuevas',
  'campers seminuevas',
  'comprar autocaravana',
  'vender autocaravana',
  'compraventa camper',
  'autocaravanas Barcelona',
  'CampersNova',
]

// NAP (Name / Address / Phone) — usado en el structured data de negocio local.
export const BUSINESS = {
  name: SITE_NAME,
  legalName: SITE_LEGAL_NAME,
  email: 'info@campersnova.com',
  phone: '+34645639185',
  phoneDisplay: '645 63 91 85',
  whatsapp: 'https://wa.me/34645639185',
  street: 'Carrer Torre de Cellers',
  city: 'Barcelona',
  region: 'Barcelona',
  postalCode: '08150',
  country: 'ES',
} as const

/** Rutas del backoffice/privadas que NO deben indexarse. */
export const PRIVATE_PATH_PREFIXES = [
  '/dashboard',
  '/vendedores',
  '/compradores',
  '/vehiculos',
  '/taller',
  '/entregas',
  '/postventa',
  '/usuarios',
  '/ajustes',
  '/matches',
  '/api',
  '/login',
  '/auth',
]

/** Rutas públicas estáticas para el sitemap. */
export const PUBLIC_ROUTES = [
  '/',
  '/comprar',
  '/vender',
  '/como-funciona',
  '/sobre',
  '/contacto',
  '/aviso-legal',
  '/privacidad',
  '/cookies',
]

/** Datos estructurados de negocio local (AutoDealer) para landing y contacto. */
export function autoDealerJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: BUSINESS.name,
    legalName: BUSINESS.legalName,
    url: SITE_URL,
    email: BUSINESS.email,
    telephone: BUSINESS.phone,
    image: `${SITE_URL}/opengraph-image`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.street,
      addressLocality: BUSINESS.city,
      addressRegion: BUSINESS.region,
      postalCode: BUSINESS.postalCode,
      addressCountry: BUSINESS.country,
    },
    areaServed: 'ES',
    sameAs: [BUSINESS.whatsapp],
    priceRange: '€€',
  }
}
