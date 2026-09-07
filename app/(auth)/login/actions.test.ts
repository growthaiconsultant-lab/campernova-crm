import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GENERIC_MAGIC_LINK_ERROR,
  RATE_LIMIT_MAGIC_LINK_ERROR,
} from '@/lib/auth/magic-link-messages'

const { mockFindUnique, mockSignInWithOtp } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockSignInWithOtp: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: mockFindUnique } },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { signInWithOtp: mockSignInWithOtp } }),
}))

import { sendMagicLink } from './actions'

describe('sendMagicLink', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'test')
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    consoleError.mockRestore()
  })

  it('rechaza un email no registrado antes de llamar al proveedor', async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(sendMagicLink('unknown@example.com')).resolves.toEqual({
      error: 'Este email no está registrado en el CRM.',
    })
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it('rechaza un usuario inactivo antes de llamar al proveedor', async () => {
    mockFindUnique.mockResolvedValue({ active: false })

    await expect(sendMagicLink('inactive@example.com')).resolves.toEqual({
      error: 'Tu cuenta está desactivada. Contacta con el administrador.',
    })
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it('envía al callback estable de Preview para un usuario activo', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_BRANCH_URL', 'campernova-crm-git-cod-auth-example.vercel.app')
    mockFindUnique.mockResolvedValue({ active: true })
    mockSignInWithOtp.mockResolvedValue({ error: null })

    await expect(sendMagicLink('agent@example.com')).resolves.toEqual({})
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'agent@example.com',
      options: {
        shouldCreateUser: true,
        emailRedirectTo: 'https://campernova-crm-git-cod-auth-example.vercel.app/auth/callback',
      },
    })
  })

  it.each([{ code: 'over_email_send_rate_limit' }, { status: 429 }])(
    'explica el límite temporal sin registrar el error: %j',
    async (error) => {
      mockFindUnique.mockResolvedValue({ active: true })
      mockSignInWithOtp.mockResolvedValue({ error })

      await expect(sendMagicLink('agent@example.com')).resolves.toEqual({
        error: RATE_LIMIT_MAGIC_LINK_ERROR,
      })
      expect(consoleError).not.toHaveBeenCalled()
    }
  )

  it('oculta el detalle de un rechazo desconocido y deja una señal segura', async () => {
    mockFindUnique.mockResolvedValue({ active: true })
    mockSignInWithOtp.mockResolvedValue({
      error: { message: 'agent@example.com rejected', status: 500 },
    })

    await expect(sendMagicLink('agent@example.com')).resolves.toEqual({
      error: GENERIC_MAGIC_LINK_ERROR,
    })
    expect(consoleError).toHaveBeenCalledWith('[auth] Magic link provider rejected the request')
  })

  it('recupera una excepción de transporte sin exponer su payload', async () => {
    mockFindUnique.mockResolvedValue({ active: true })
    mockSignInWithOtp.mockRejectedValue(new Error('agent@example.com network payload'))

    await expect(sendMagicLink('agent@example.com')).resolves.toEqual({
      error: GENERIC_MAGIC_LINK_ERROR,
    })
    expect(consoleError).toHaveBeenCalledWith(
      '[auth] Magic link provider request failed unexpectedly'
    )
  })

  it('falla de forma segura si producción no tiene URL canónica', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    mockFindUnique.mockResolvedValue({ active: true })

    await expect(sendMagicLink('agent@example.com')).resolves.toEqual({
      error: GENERIC_MAGIC_LINK_ERROR,
    })
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      '[auth] Magic link callback configuration is invalid',
      { environment: 'production' }
    )
  })
})
