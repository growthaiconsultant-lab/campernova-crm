import type { MetadataRoute } from 'next'
import { SITE_URL, PUBLIC_ROUTES } from '@/lib/seo'
import { DUMMY_VEHICLES } from '@/lib/dummy/vehicles'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const priorityFor = (route: string): number => {
    if (route === '/') return 1
    if (route === '/comprar' || route === '/vender') return 0.9
    if (route.startsWith('/aviso-legal') || route === '/privacidad' || route === '/cookies')
      return 0.3
    return 0.7
  }

  const staticRoutes: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route === '/' ? '' : route}`,
    lastModified: now,
    changeFrequency: route === '/comprar' ? 'daily' : 'weekly',
    priority: priorityFor(route),
  }))

  // Fichas de vehículo públicas (catálogo /comprar/[id]).
  const vehicleRoutes: MetadataRoute.Sitemap = DUMMY_VEHICLES.map((v) => ({
    url: `${SITE_URL}/comprar/${v.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [...staticRoutes, ...vehicleRoutes]
}
