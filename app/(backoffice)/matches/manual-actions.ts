'use server'

import { revalidatePath } from 'next/cache'
import { requireAgente } from '@/lib/auth'
import { db } from '@/lib/db'
import { LockError } from '@/lib/locking/errors'
import {
  associateManualMatch,
  searchManualMatchCandidates,
  manualMatchSchema,
  manualMatchSearchSchema,
  ManualMatchError,
} from '@/lib/manual-matches'

function errorMessage(error: unknown) {
  if (error instanceof ManualMatchError) return error.message
  if (error instanceof LockError && error.code === 'ROOT_NOT_FOUND')
    return 'La ficha ya no existe. Actualiza y busca de nuevo.'
  return 'No se pudo confirmar la asociación. Reintenta con la misma selección; no se duplicará.'
}

export async function createManualMatch(input: unknown) {
  const actor = await requireAgente()
  const parsed = manualMatchSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false as const, error: 'Selecciona un vehículo y un comprador válidos.' }
  try {
    const result = await associateManualMatch(db, actor.id, parsed.data)
    for (const path of [
      `/compradores/${parsed.data.buyerLeadId}`,
      `/vendedores/${result.sellerLeadId}`,
      '/matches',
      '/compradores',
      '/vendedores',
      '/vehiculos',
    ])
      revalidatePath(path)
    return { ok: true as const, saved: result.saved }
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) }
  }
}

export async function searchManualMatches(input: unknown) {
  await requireAgente()
  const parsed = manualMatchSearchSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false as const, error: 'Revisa el texto de búsqueda e inténtalo de nuevo.' }
  try {
    return { ok: true as const, ...(await searchManualMatchCandidates(db, parsed.data)) }
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof ManualMatchError
          ? error.message
          : 'No se pudo buscar. Inténtalo de nuevo.',
    }
  }
}
