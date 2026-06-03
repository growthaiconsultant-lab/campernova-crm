import type { MetadataRoute } from 'next'
import { SITE_URL, PUBLIC_ROUTES } from '@/lib/seo'
import { getPublishedVehicles } from '@/lib/public-catalog'

// Revalida cada 10 min para reflejar el stock publicado en el CRM.
export const revalidate = 600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  // Fichas de vehículo públicas reales (vehículos PUBLICADO del CRM).
  // Resiliente: si la DB falla, el sitemap se genera igual con las rutas estáticas.
  let vehicleRoutes: MetadataRoute.Sitemap = []
  try {
    const vehicles = await getPublishedVehicles()
    vehicleRoutes = vehicles.map((v) => ({
      url: `${SITE_URL}/comprar/${v.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))
  } catch (err) {
    console.error('[sitemap] no se pudieron cargar los vehículos publicados:', err)
  }

  return [...staticRoutes, ...vehicleRoutes]
}
