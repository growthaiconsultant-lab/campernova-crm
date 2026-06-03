import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { resolveLegacyRedirect, isLegacyGone } from '@/lib/legacy-redirects'

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/auth/callback',
  '/vender',
  '/contacto',
  '/aviso-legal',
  '/privacidad',
  '/cookies',
  '/api/valuation',
  '/comprar',
  '/api/chat',
  '/como-funciona',
  '/sobre',
  // SEO / metadata routes — deben ser accesibles sin auth para buscadores y redes
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/opengraph-image',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Redirecciones 301 del WordPress antiguo — lo primero, antes del guard de auth
  // (el middleware corre antes que redirects() de next.config, por eso van aquí).
  const legacyDest = resolveLegacyRedirect(pathname)
  if (legacyDest) {
    const url = request.nextUrl.clone()
    url.pathname = legacyDest
    url.search = ''
    return NextResponse.redirect(url, 308)
  }

  // Contenido del WP eliminado para siempre y sin valor SEO → 410 Gone
  // (señal correcta a Google: "ya no existe", en vez de redirigir a /login).
  if (isLegacyGone(pathname)) {
    return new NextResponse('Gone', { status: 410 })
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  // Las rutas públicas (landing, /comprar, /vender, robots, sitemap…) no necesitan
  // consultar Supabase Auth. Saltar esa llamada de red evita el cold-start del
  // middleware (MIDDLEWARE_INVOCATION_TIMEOUT / 504) en todo el sitio público.
  // Excepción: /login sí comprueba sesión para redirigir a un usuario ya logueado.
  if (isPublic && pathname !== '/login') {
    return NextResponse.next({ request })
  }

  const { supabaseResponse, user } = await updateSession(request)

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
