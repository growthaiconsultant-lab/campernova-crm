'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { recalculateMatchesForBuyer } from '@/lib/matching'
import { usageSchema } from '@/lib/buyer-vehicle-use'

const changeSchema = z
  .object({ id: z.string().min(1).max(100), before: usageSchema, after: usageSchema })
  .strict()

export async function saveBuyerUsage(input: unknown) {
  await requireAgente()
  const change = changeSchema.safeParse(input)
  if (!change.success) return { error: 'Revisa el uso y los detalles antes de guardar.' }
  const { id, before, after } = change.data
  const active = { id, archivedAt: null, mergedIntoId: null }
  const result = await db.buyerLead.updateMany({ where: { ...active, ...before }, data: after })
  // A retry may follow a lost response or a failed match recalculation.
  if (!result.count && !(await db.buyerLead.count({ where: { ...active, ...after } })))
    return { error: 'La ficha ha cambiado. Actualiza la página para ver los datos actuales.' }
  if (before.useZone !== after.useZone) {
    await recalculateMatchesForBuyer(id, db)
    revalidatePath('/matches')
  }
  revalidatePath('/compradores/' + id)
  return { ok: true }
}
