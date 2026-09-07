'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { GENERIC_MAGIC_LINK_ERROR, magicLinkErrorMessage } from '@/lib/auth/magic-link-messages'
import { resolveMagicLinkRedirectUrl } from '@/lib/auth/magic-link-redirect'

export async function sendMagicLink(email: string): Promise<{ error?: string }> {
  const user = await db.user.findUnique({ where: { email } })

  if (!user) {
    return { error: 'Este email no está registrado en el CRM.' }
  }

  if (!user.active) {
    return { error: 'Tu cuenta está desactivada. Contacta con el administrador.' }
  }

  let emailRedirectTo: string

  try {
    emailRedirectTo = resolveMagicLinkRedirectUrl()
  } catch {
    console.error('[auth] Magic link callback configuration is invalid', {
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    })
    return { error: GENERIC_MAGIC_LINK_ERROR }
  }

  const supabase = createClient()
  let providerError: unknown

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo,
      },
    })
    providerError = error
  } catch {
    console.error('[auth] Magic link provider request failed unexpectedly')
    return { error: GENERIC_MAGIC_LINK_ERROR }
  }

  if (providerError) {
    const errorMessage = magicLinkErrorMessage(providerError)
    if (errorMessage === GENERIC_MAGIC_LINK_ERROR) {
      console.error('[auth] Magic link provider rejected the request')
    }
    return { error: errorMessage }
  }

  return {}
}
