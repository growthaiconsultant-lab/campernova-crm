import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verificación de sesión en el middleware (corre en CADA request del backoffice).
  // `getClaims()` valida el JWT de forma local — sin roundtrip al servidor de Auth cuando el
  // proyecto usa claves de firma asimétricas — y refresca la sesión si hace falta. Es más
  // rápido que `getUser()` (que siempre va a la red) en cada navegación.
  // Fallback defensivo: si `getClaims()` no devuelve claims o falla, caemos a `getUser()` para
  // no romper el acceso del equipo bajo ninguna circunstancia.
  let userId: string | null = null
  try {
    const { data, error } = await supabase.auth.getClaims()
    if (!error && data?.claims?.sub) {
      userId = data.claims.sub
    }
  } catch {
    userId = null
  }

  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }

  return { supabase, supabaseResponse, user: userId ? { id: userId } : null }
}
