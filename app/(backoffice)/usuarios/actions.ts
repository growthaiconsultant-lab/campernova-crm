'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { createUserSchema, updateUserSchema } from '@/lib/validators/user'

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export async function createUser(formData: unknown): Promise<ActionResult> {
  await requireAdmin()

  const parsed = createUserSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { name, email, role, active, notifyOnNewLead } = parsed.data

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return {
      ok: false,
      error: 'Ya existe un usuario con ese email',
      fieldErrors: { email: ['Email ya registrado'] },
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.user as any).create({
    data: { name, email, role, active, notifyOnNewLead, authId: null },
  })

  revalidatePath('/usuarios')
  return { ok: true }
}

export async function updateUser(id: string, formData: unknown): Promise<ActionResult> {
  const actor = await requireAdmin()

  const parsed = updateUserSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { name, role, active, notifyOnNewLead } = parsed.data

  // Guard: no auto-demote ADMIN role
  if (id === actor.id && role !== 'ADMIN') {
    return { ok: false, error: 'No puedes quitarte el rol ADMIN a ti mismo.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.user as any).update({
    where: { id },
    data: { name, role, active, notifyOnNewLead },
  })

  revalidatePath('/usuarios')
  revalidatePath(`/usuarios/${id}`)
  return { ok: true }
}

export async function toggleUserActive(id: string, newActive: boolean): Promise<ActionResult> {
  const actor = await requireAdmin()

  if (id === actor.id && !newActive) {
    return { ok: false, error: 'No puedes desactivarte a ti mismo.' }
  }

  if (!newActive) {
    // Check for active leads assigned to this user
    const [sellerCount, buyerCount] = await Promise.all([
      db.sellerLead.count({
        where: {
          agentId: id,
          status: { notIn: ['CERRADO', 'DESCARTADO'] },
        },
      }),
      db.buyerLead.count({
        where: {
          agentId: id,
          status: { notIn: ['CERRADO', 'PERDIDO'] },
        },
      }),
    ])
    const total = sellerCount + buyerCount
    if (total > 0) {
      return {
        ok: false,
        error: `Este usuario tiene ${total} lead${total > 1 ? 's' : ''} activo${total > 1 ? 's' : ''}. Reasígnalos antes de desactivar.`,
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.user as any).update({ where: { id }, data: { active: newActive } })

  revalidatePath('/usuarios')
  revalidatePath(`/usuarios/${id}`)
  return { ok: true }
}

export async function toggleUserNotifyOnNewLead(id: string, value: boolean): Promise<ActionResult> {
  await requireAdmin()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.user as any).update({ where: { id }, data: { notifyOnNewLead: value } })

  revalidatePath('/usuarios')
  return { ok: true }
}
