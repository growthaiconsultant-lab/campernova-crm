'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAgente } from '@/lib/auth'
import { catalogSchema } from '@/lib/matching/catalog'
import { recalculateMatchesForBuyer, recalculateMatchesForVehicle } from '@/lib/matching'
const editSchema = z.object({
  side: z.enum(['buyer', 'vehicle']),
  id: z.string().min(1).max(100),
  before: catalogSchema,
  after: catalogSchema,
})
export async function saveCatalog(input: unknown) {
  await requireAgente()
  const parsed = editSchema.safeParse(input)
  if (!parsed.success) return { error: 'Revisa las características y los valores numéricos.' }
  const { side, id, before, after } = parsed.data
  const where = { id, matchCatalog: { equals: before } }
  const change =
    side === 'buyer'
      ? await db.buyerLead.updateMany({
          where: { ...where, archivedAt: null },
          data: { matchCatalog: after },
        })
      : await db.vehicle.updateMany({
          where: { ...where, sellerLead: { archivedAt: null } },
          data: { matchCatalog: after },
        })
  if (!change.count)
    return { error: 'La ficha ha cambiado. Actualiza la página antes de volver a guardar.' }
  if (side === 'buyer') {
    await recalculateMatchesForBuyer(id, db)
    revalidatePath('/compradores/' + id)
  } else {
    await recalculateMatchesForVehicle(id, db)
    revalidatePath('/vendedores/[id]', 'page')
  }
  revalidatePath('/matches')
  return { ok: true }
}
