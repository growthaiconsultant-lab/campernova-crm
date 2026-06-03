/**
 * Redirecciones 301 desde el WordPress antiguo (campersnova.com) a la web nueva.
 * Se resuelven en el middleware (corre antes que las rutas), por lo que tienen
 * prioridad sobre el guard de auth. Ver docs/migration/README.md.
 */

// Solo se redirigen las URLs con VALOR SEO real (páginas con autoridad/enlaces y
// las fichas de vehículo). El resto del WordPress antiguo (taxonomías ?taxonomy=…,
// productos demo de WooCommerce, carrito, plantillas internas) NO se redirige:
// no tiene valor SEO y dejarlo caer en 404 le indica a Google "ya no existe".
// Ver docs/migration/README.md § "¿Qué redirigir y qué no".

/** Mapeo exacto de páginas que cambian de slug. */
const EXACT: Record<string, string> = {
  '/tasacion': '/vender',
  '/gestion-de-venta': '/vender',
  '/cars': '/comprar',
  '/politica-de-cookies': '/cookies',
  '/privacy-policy': '/privacidad',
}

/** Fichas de vehículo del WP → catálogo (sin equivalente 1:1 todavía). */
const PREFIX_TO_COMPRAR = ['/listings']

/**
 * Devuelve la ruta destino para un path antiguo, o null si no aplica.
 * Normaliza el trailing slash del WordPress.
 */
export function resolveLegacyRedirect(pathname: string): string | null {
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  if (EXACT[path]) return EXACT[path]

  for (const prefix of PREFIX_TO_COMPRAR) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return '/comprar'
  }

  return null
}
