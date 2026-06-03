import type { MetadataRoute } from 'next'
import { SITE_URL, PUBLIC_ROUTES } from '@/lib/seo'
import { getPublishedVehicles, brandSlug } from '@/lib/public-catalog'

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

  // Fichas de vehículo + páginas de catálogo (categorías/marcas) desde el stock real.
  // Solo se incluyen las páginas de catálogo que tienen contenido (evita indexar
  // listados vacíos/finos). Resiliente: si la DB falla, quedan las rutas estáticas.
  let dynamicRoutes: MetadataRoute.Sitemap = []
  try {
    const vehicles = await getPublishedVehicles()

    const vehicleRoutes: MetadataRoute.Sitemap = vehicles.map((v) => ({
      url: `${SITE_URL}/comprar/${v.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    const catalogPaths: string[] = []
    if (vehicles.length > 0) {
      catalogPaths.push('/comprar/vehiculos', '/comprar/marcas')
    }
    if (vehicles.some((v) => v.type === 'AUTOCARAVANA')) catalogPaths.push('/comprar/autocaravanas')
    if (vehicles.some((v) => v.type === 'CAMPER')) catalogPaths.push('/comprar/campers')
    for (const slug of Array.from(new Set(vehicles.map((v) => brandSlug(v.brand))))) {
      catalogPaths.push(`/comprar/marcas/${slug}`)
    }

    const catalogRoutes: MetadataRoute.Sitemap = catalogPaths.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.75,
    }))

    dynamicRoutes = [...catalogRoutes, ...vehicleRoutes]
  } catch (err) {
    console.error('[sitemap] no se pudieron cargar los vehículos publicados:', err)
  }

  return [...staticRoutes, ...dynamicRoutes]
}
