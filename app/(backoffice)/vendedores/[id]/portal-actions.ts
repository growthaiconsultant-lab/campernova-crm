'use server'
import { revalidatePath } from 'next/cache'
import { requireAgente } from '@/lib/auth'
import { withLockedRoots } from '@/lib/locking'
import { listingChange } from '@/lib/portal-listings'

export async function savePortalListing(sellerId: string, vehicleId: string, raw: unknown) {
  await requireAgente()
  const parsed = listingChange.safeParse(raw)
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Revisa el enlace y la fecha.' }
  const input = parsed.data
  try {
    const result = await withLockedRoots(
      [
        { type: 'vehicle', id: vehicleId },
        { type: 'sellerLead', id: sellerId },
      ],
      async (tx) => {
        const vehicle = await tx.vehicle.findUnique({
          where: { id: vehicleId },
          select: {
            sellerLeadId: true,
            sellerLead: { select: { intakeStatus: true, archivedAt: true } },
          },
        })
        if (
          vehicle?.sellerLeadId !== sellerId ||
          vehicle.sellerLead.intakeStatus !== 'ADMITIDO' ||
          vehicle.sellerLead.archivedAt
        )
          return { error: 'La ficha debe estar admitida y activa para editar sus anuncios.' }
        const where = { vehicleId_channel: { vehicleId, channel: input.channel } }
        const current = await tx.vehiclePortalListing.findUnique({ where })
        if (input.action === 'withdraw' && current?.withdrawnAt) return { ok: true }
        if (
          input.action === 'publish' &&
          current &&
          !current.withdrawnAt &&
          current.url === input.url &&
          current.publishedOn.toISOString().slice(0, 10) === input.publishedOn
        )
          return { ok: true }
        if ((current?.revision ?? 0) !== input.revision)
          return {
            error: 'El anuncio ha cambiado. Actualiza la ficha para ver la última versión.',
            stale: true,
          }
        if (input.action === 'withdraw') {
          if (!current) return { error: 'No hay una publicación registrada para retirar.' }
          await tx.vehiclePortalListing.update({
            where,
            data: { withdrawnAt: new Date(), revision: { increment: 1 } },
          })
        } else {
          const data = {
            url: input.url,
            publishedOn: new Date(input.publishedOn + 'T00:00:00Z'),
            withdrawnAt: null,
          }
          if (current)
            await tx.vehiclePortalListing.update({
              where,
              data: { ...data, revision: { increment: 1 } },
            })
          else
            await tx.vehiclePortalListing.create({
              data: { ...data, vehicleId, channel: input.channel },
            })
        }
        return { ok: true }
      }
    )
    if (!result.ok) return result
  } catch {
    return { error: 'No se pudo confirmar el guardado. Puedes reintentar con los mismos datos.' }
  }
  revalidatePath('/vendedores/' + sellerId)
  return { ok: true }
}
