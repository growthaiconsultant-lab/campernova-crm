'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { mergeBuyerLeads } from '@/lib/buyer-merge'

const inputSchema = z.object({
  ids: z.array(z.string().min(1).max(150)).length(2),
  targetVersion: z.string().datetime(),
  sourceVersion: z.string().datetime(),
  responsibleId: z.string().min(1).max(150),
})

export async function unifyBuyerContacts(form: FormData) {
  const actor = await requireAdmin()
  const input = inputSchema.parse({
    ids: form.getAll('ids'),
    targetVersion: form.get('targetVersion'),
    sourceVersion: form.get('sourceVersion'),
    responsibleId: form.get('responsibleId'),
  })
  const id = await mergeBuyerLeads(db, { ...input, actorId: actor.id })
  for (const path of [
    '/compradores',
    '/compradores/duplicados',
    '/dashboard',
    '/calendario',
    ...input.ids.map((id) => `/compradores/${id}`),
  ])
    revalidatePath(path)
  redirect(`/compradores/${id}?tab=actividad`)
}
