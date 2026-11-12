'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireCanEditTaller } from '@/lib/auth'
import { draftInput } from '@/lib/entry/owner-quote'
import {
  claimQuoteDelivery,
  QuoteError,
  recordQuoteDelivery,
  saveOwnerDraft,
} from '@/lib/entry/owner-quote-store'
import { quoteMailer } from '@/lib/email/owner-quote'

function message(error: unknown) {
  return error instanceof QuoteError
    ? error.message
    : 'No se ha podido confirmar la operación. Actualiza la inspección antes de reintentar.'
}

export async function saveQuoteAction(orderId: string, raw: unknown) {
  await requireCanEditTaller()
  const input = draftInput.safeParse(raw)
  if (!z.string().cuid().safeParse(orderId).success || !input.success)
    return { error: 'Revisa las partidas y sus importes.' }
  try {
    await saveOwnerDraft(orderId, input.data)
    revalidatePath('/taller/' + orderId)
    return { ok: true }
  } catch (error) {
    return { error: message(error) }
  }
}

export async function sendQuoteAction(orderId: string, raw: unknown) {
  await requireCanEditTaller()
  const input = z
    .object({
      version: z.number().int().positive(),
      revision: z.number().int().positive(),
      email: z.string().email(),
    })
    .safeParse(raw)
  if (!z.string().cuid().safeParse(orderId).success || !input.success)
    return { error: 'Revisa la versión y el correo del propietario.' }
  try {
    const deliver = quoteMailer()
    const q = await claimQuoteDelivery(
      orderId,
      input.data.version,
      input.data.revision,
      input.data.email
    )
    await deliver(q)
    await recordQuoteDelivery(q.id)
    return { ok: true }
  } catch (error) {
    return { error: message(error) }
  } finally {
    revalidatePath('/taller/' + orderId)
  }
}
