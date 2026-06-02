import type { MetadataRoute } from 'next'
import { SITE_URL, PRIVATE_PATH_PREFIXES } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // El backoffice y las rutas privadas/API no se indexan.
      disallow: PRIVATE_PATH_PREFIXES.map((p) => `${p}/`),
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
