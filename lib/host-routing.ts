/**
 * Routing por host (subdominio del CRM). Decide si una petición debe redirigirse
 * entre el apex público (`campersnova.com`) y el subdominio del backoffice
 * (`crm.campersnova.com`). Puro y testeable; el middleware lo llama con la
 * config del entorno. **No-op** si `CRM_HOST` no está definido o el host es de
 * desarrollo/preview → despliegue seguro y cutover por env var.
 */

/** Rutas de UI del backoffice (excluye `/api`, que puede ser público o cron). */
const BACKOFFICE_PREFIXES = [
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
  '/analytics',
  '/captaciones',
  '/ofertas',
  '/calendario',
  '/login',
  '/auth',
]

/** Rutas de marketing público (sin la raíz `/`, que se trata aparte). */
const PUBLIC_MARKETING_PREFIXES = [
  '/comprar',
  '/vender',
  '/sobre',
  '/como-funciona',
  '/contacto',
  '/aviso-legal',
  '/privacidad',
  '/cookies',
]

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function isBackofficePath(pathname: string): boolean {
  return matchesPrefix(pathname, BACKOFFICE_PREFIXES)
}

export function isPublicMarketingPath(pathname: string): boolean {
  return matchesPrefix(pathname, PUBLIC_MARKETING_PREFIXES)
}

export type HostRedirectInput = {
  host: string | null
  pathname: string
  search?: string
  /** Host del CRM (p.ej. `crm.campersnova.com`). Vacío = feature apagada. */
  crmHost?: string
  /** Host del apex público (p.ej. `campersnova.com`). */
  apexHost: string
}

/**
 * Devuelve la URL absoluta a la que redirigir (308), o `null` si no aplica.
 * - Apex + ruta de backoffice → mismo path en el host del CRM (preserva query).
 * - CRM + `/` → `/dashboard` (el guard de auth hará el resto).
 * - CRM + ruta de marketing público → mismo path en el apex.
 */
export function resolveHostRedirect(input: HostRedirectInput): string | null {
  const { pathname, search = '', crmHost, apexHost } = input
  if (!crmHost || !apexHost) return null

  const host = (input.host ?? '').split(':')[0].toLowerCase()
  // Dev / preview: no forzar hosts (una sola URL).
  if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) {
    return null
  }

  if (host === apexHost && isBackofficePath(pathname)) {
    return `https://${crmHost}${pathname}${search}`
  }

  if (host === crmHost) {
    if (pathname === '/') return `https://${crmHost}/dashboard`
    if (isPublicMarketingPath(pathname)) return `https://${apexHost}${pathname}${search}`
  }

  return null
}

/** Host del apex derivado de `NEXT_PUBLIC_SITE_URL` (sin protocolo ni barra). */
export function apexHostFromEnv(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || 'https://campersnova.com').trim()
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .split(':')[0]
    .toLowerCase()
}
