import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import type { User } from '@prisma/client'

export async function requireAuth(): Promise<User> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const dbUser = await db.user.findUnique({ where: { authId: user.id } })
  if (!dbUser || !dbUser.active) redirect('/login')

  return dbUser
}

export async function requireAdmin(): Promise<User> {
  const dbUser = await requireAuth()
  if (dbUser.role !== 'ADMIN') redirect('/dashboard')
  return dbUser
}
