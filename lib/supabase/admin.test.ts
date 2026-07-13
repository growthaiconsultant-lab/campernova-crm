import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Sella `createClient` de supabase-js para no crear un cliente real ni tocar red.
const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ __kind: 'admin-client' })),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }))

import { getSupabaseAdminClient, resetSupabaseAdminClientCache } from './admin'

const URL = 'http://127.0.0.1:54321'
const KEY = 'local-service-role-key'

beforeEach(() => {
  vi.clearAllMocks()
  resetSupabaseAdminClientCache()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', KEY)
})

afterEach(() => {
  vi.unstubAllEnvs()
  resetSupabaseAdminClientCache()
})

describe('getSupabaseAdminClient', () => {
  it('crea el cliente con service_role sin persistir sesión, y lo memoiza', () => {
    const a = getSupabaseAdminClient()
    const b = getSupabaseAdminClient()
    expect(a).toBe(b) // memoizado (una sola instancia)
    expect(createClientMock).toHaveBeenCalledTimes(1)
    const [url, key, opts] = createClientMock.mock.calls[0] as unknown as [
      string,
      string,
      { auth: { persistSession: boolean; autoRefreshToken: boolean } },
    ]
    expect(url).toBe(URL)
    expect(key).toBe(KEY)
    expect(opts.auth.persistSession).toBe(false)
    expect(opts.auth.autoRefreshToken).toBe(false)
  })

  it('lanza (sin crear cliente) si falta SUPABASE_SERVICE_ROLE_KEY', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect(() => getSupabaseAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('lanza si falta NEXT_PUBLIC_SUPABASE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(() => getSupabaseAdminClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('lanza si se invoca en el navegador (server-only)', () => {
    // Simula entorno de navegador: `window` definido.
    vi.stubGlobal('window', {})
    try {
      expect(() => getSupabaseAdminClient()).toThrow(/navegador|server-only/)
      expect(createClientMock).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
