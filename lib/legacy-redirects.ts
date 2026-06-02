/**
 * Redirecciones 301 desde el WordPress antiguo (campersnova.com) a la web nueva.
 * Se resuelven en el middleware (corre antes que las rutas), por lo que tienen
 * prioridad sobre el guard de auth. Ver docs/migration/README.md.
 */

/** Mapeo exacto de rutas que cambian de slug. */
const EXACT: Record<string, string> = {
  '/tasacion': '/vender',
  '/gestion-de-venta': '/vender',
  '/cars': '/comprar',
  '/carrito': '/comprar',
  '/politica-de-cookies': '/cookies',
  '/privacy-policy': '/privacidad',
}

/** Prefijos cuyo subárbol entero va al catálogo (sin equivalente 1:1 todavía). */
const PREFIX_TO_COMPRAR = ['/listings', '/producto', '/categoria-producto']

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
