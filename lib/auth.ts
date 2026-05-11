import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import type { User, UserRole } from '@prisma/client'

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
  if (dbUser.role !== 'ADMIN') redirect('/dashboard?error=forbidden')
  return dbUser
}

// Generic role guard — redirects to /dashboard?error=forbidden if not in allowed roles
export async function requireRole(roles: UserRole[]): Promise<User> {
  const dbUser = await requireAuth()
  if (!roles.includes(dbUser.role)) redirect('/dashboard?error=forbidden')
  return dbUser
}

// Boolean helper for conditional UI — never redirects
export function userHasRole(user: User, roles: UserRole[]): boolean {
  return roles.includes(user.role)
}

// ── Semantic helpers ────────────────────────────────────────────

// Vendedores / compradores / vehículos (comercial module)
// ADMIN + AGENTE
export function requireAgente() {
  return requireRole(['ADMIN', 'AGENTE'])
}

// Taller: read
// ADMIN + AGENTE + TALLER
export function requireCanViewTaller() {
  return requireRole(['ADMIN', 'AGENTE', 'TALLER'])
}

// Taller: create/edit orders, checklist, hours, parts
// ADMIN + TALLER
export function requireCanEditTaller() {
  return requireRole(['ADMIN', 'TALLER'])
}

// Entregas: read + create
// ADMIN + AGENTE + ENTREGAS
export function requireCanViewEntregas() {
  return requireRole(['ADMIN', 'AGENTE', 'ENTREGAS'])
}

// Entregas: edit checklist, sign, upload docs
// ADMIN + ENTREGAS
export function requireCanEditEntregas() {
  return requireRole(['ADMIN', 'ENTREGAS'])
}

// Postventa: read + create
// ADMIN + AGENTE + ENTREGAS
export function requireCanViewPostventa() {
  return requireRole(['ADMIN', 'AGENTE', 'ENTREGAS'])
}

// Postventa: change status, add costs
// ADMIN + ENTREGAS
export function requireCanEditPostventa() {
  return requireRole(['ADMIN', 'ENTREGAS'])
}

// Ads / fotos / publicación
// ADMIN + AGENTE + MARKETING
export function requireCanGenerateAds() {
  return requireRole(['ADMIN', 'AGENTE', 'MARKETING'])
}
