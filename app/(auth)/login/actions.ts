'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

export async function sendMagicLink(email: string): Promise<{ error?: string }> {
  const user = await db.user.findUnique({ where: { email } })

  if (!user) {
    return { error: 'Este email no está registrado en el CRM.' }
  }

  if (!user.active) {
    return { error: 'Tu cuenta está desactivada. Contacta con el administrador.' }
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    return { error: 'No se pudo enviar el enlace. Inténtalo de nuevo.' }
  }

  return {}
}
