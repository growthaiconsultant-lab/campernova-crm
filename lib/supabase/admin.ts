/**
 * PR5B2 — Cliente ADMINISTRATIVO de Supabase (service_role). EXCLUSIVAMENTE servidor.
 *
 * El bucket privado `vehicle-documents` es DENY-ALL para `anon`/`authenticated` (sin políticas):
 * la autorización real del CRM vive en Prisma, no en el JWT de Supabase. Por eso las operaciones
 * privadas de Storage (subida, firma de URL, borrado) las realiza el servidor con `service_role`,
 * que ignora RLS, SIEMPRE después de autorizar con Prisma en la Server Action.
 *
 * Protección server-only (equivalente a `import "server-only"`, que no es dependencia del repo):
 *  - guard en tiempo de ejecución: lanza si se invoca en el navegador;
 *  - la clave se lee de `SUPABASE_SERVICE_ROLE_KEY` (SIN prefijo `NEXT_PUBLIC_`), por lo que
 *    Next.js NUNCA la inyecta en el bundle de cliente (en el navegador sería `undefined`);
 *  - validación PEREZOSA: no se evalúa en import/build (Vercel compila sin el secreto); solo al
 *    invocarse en runtime server-side. Falla con un mensaje claro si falta la variable.
 *
 * NO es un cliente genérico: úsalo solo para el canal de documentos privados. No lo emplees para
 * autenticación de usuarios ni para operaciones públicas (fotos).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedAdminClient: SupabaseClient | null = null

function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      'El cliente admin de Supabase (service_role) no puede usarse en el navegador (server-only).'
    )
  }
}

/**
 * Devuelve el cliente `service_role` (memoizado). Lanza si se llama desde el navegador o si
 * falta configuración. No expone la clave; el cliente encapsula la credencial.
 */
export function getSupabaseAdminClient(options?: { timeoutMs: number }): SupabaseClient {
  assertServerOnly()
  if (!options && cachedAdminClient) return cachedAdminClient
  if (
    options &&
    (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 60_000)
  )
    throw new Error('Timeout de Storage inválido.')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL no está definida.')
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no está definida (requerida en servidor para el bucket privado de documentos).'
    )
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(options
      ? {
          global: {
            fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
              const controller = new AbortController()
              const previous = init?.signal ?? (input instanceof Request ? input.signal : undefined)
              const abort = () => controller.abort()
              if (previous?.aborted) abort()
              previous?.addEventListener('abort', abort, { once: true })
              const timer = setTimeout(abort, options.timeoutMs)
              try {
                return await fetch(input, { ...init, signal: controller.signal })
              } finally {
                clearTimeout(timer)
                previous?.removeEventListener('abort', abort)
              }
            },
          },
        }
      : {}),
  })
  if (!options) cachedAdminClient = client
  return client
}

/** Solo para tests: descarta el cliente memoizado para reevaluar la configuración. */
export function resetSupabaseAdminClientCache(): void {
  cachedAdminClient = null
}
