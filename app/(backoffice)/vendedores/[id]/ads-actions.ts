'use server'

import { z } from 'zod'
import { salePortals } from '@/lib/portal-listings'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireCanGenerateAds } from '@/lib/auth'
import { generateAd } from '@/lib/ads/generate'
import type { AdChannel } from '@prisma/client'

export async function generateVehicleAd(vehicleId: string, channel: 'WALLAPOP' | 'COCHESNET') {
  const actor = await requireCanGenerateAds()

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      photos: { orderBy: { order: 'asc' } },
      sellerLead: { select: { id: true } },
    },
  })
  if (!vehicle) return { error: 'Vehículo no encontrado' }

  const photoUrls = vehicle.photos.slice(0, 5).map((p) => p.url)

  let result: Awaited<ReturnType<typeof generateAd>>
  try {
    result = await generateAd({ vehicle, photoUrls, channel })
  } catch (err) {
    console.error('[ads] generateAd failed:', err)
    return { error: 'Error al generar el anuncio. Inténtalo de nuevo.' }
  }

  const sellerLeadId = vehicle.sellerLead?.id ?? null

  const ad = await db.vehicleAd.create({
    data: {
      vehicleId,
      channel: channel as AdChannel,
      content: result.content,
      modelUsed: result.model,
      tokensUsed: result.tokensUsed,
      createdById: actor.id,
    },
  })

  await db.activity.create({
    data: {
      type: 'ANUNCIO_GENERADO',
      content: `Anuncio ${channel} generado (${result.tokensUsed} tokens, modelo ${result.model})`,
      agentId: actor.id,
      sellerLeadId,
    },
  })

  revalidatePath(`/vendedores/${sellerLeadId}`)

  return { content: result.content, adId: ad.id, tokensUsed: result.tokensUsed }
}

const draftInput = z.object({
  vehicleId: z.string().min(1),
  channel: z.enum(salePortals),
  original: z.object({ id: z.string().min(1), content: z.string() }).nullable(),
  content: z.string().trim().min(1, 'Escribe el texto del anuncio.'),
})

export async function saveVehicleAdText(input: unknown) {
  const actor = await requireCanGenerateAds()
  const parsed = draftInput.safeParse(input)
  if (!parsed.success) return { error: 'Revisa el texto y el portal del anuncio.' }
  const { vehicleId, channel, original, content } = parsed.data
  const result = await db.$transaction(async (tx) => {
    const [vehicle] = await tx.$queryRaw<
      { seller_lead_id: string }[]
    >`SELECT seller_lead_id FROM vehicles WHERE id = ${vehicleId} FOR UPDATE`
    if (!vehicle) return { error: 'Vehículo no encontrado.' }
    const current = await tx.vehicleAd.findFirst({
      where: { vehicleId, channel },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, content: true, createdById: true },
    })
    const conflict = {
      error:
        'El texto de este portal ha cambiado. Copia tu versión y vuelve a abrir el texto actualizado.',
    }
    if (current && current.createdById !== actor.id && actor.role !== 'ADMIN')
      return { error: 'Sin permiso para editar este anuncio.' }
    if (
      current &&
      current.content === content &&
      (original?.id === current.id || (!original && current.createdById === actor.id))
    )
      return { sellerId: vehicle.seller_lead_id, id: current.id }
    if ((current?.id ?? null) !== (original?.id ?? null) || current?.content !== original?.content)
      return conflict
    const ad = current
      ? await tx.vehicleAd.update({
          where: { id: current.id },
          data: { content },
          select: { id: true },
        })
      : await tx.vehicleAd.create({
          data: {
            vehicleId,
            channel,
            content,
            modelUsed: 'manual',
            tokensUsed: 0,
            createdById: actor.id,
          },
          select: { id: true },
        })
    return { sellerId: vehicle.seller_lead_id, id: ad.id }
  })
  if ('error' in result) return { error: result.error }
  revalidatePath(`/vendedores/${result.sellerId}`)
  return { id: result.id }
}

export async function updateVehiclePublicNotes(vehicleId: string, publicNotes: string) {
  await requireCanGenerateAds()

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLead: { select: { id: true } } },
  })
  if (!vehicle) return { error: 'Vehículo no encontrado' }

  await db.vehicle.update({ where: { id: vehicleId }, data: { publicNotes } })

  revalidatePath(`/vendedores/${vehicle.sellerLead?.id}`)
  return { ok: true }
}
