'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { generateAd } from '@/lib/ads/generate'
import type { AdChannel } from '@prisma/client'

export async function generateVehicleAd(vehicleId: string, channel: 'WALLAPOP' | 'COCHESNET') {
  const actor = await requireAuth()

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

export async function updateVehicleAdContent(adId: string, content: string) {
  const actor = await requireAuth()

  const ad = await db.vehicleAd.findUnique({
    where: { id: adId },
    include: { vehicle: { select: { sellerLead: { select: { id: true } } } } },
  })
  if (!ad) return { error: 'Anuncio no encontrado' }

  if (ad.createdById !== actor.id && actor.role !== 'ADMIN') {
    return { error: 'Sin permiso para editar este anuncio' }
  }

  await db.vehicleAd.update({ where: { id: adId }, data: { content } })

  revalidatePath(`/vendedores/${ad.vehicle.sellerLead?.id}`)
  return { ok: true }
}

export async function updateVehiclePublicNotes(vehicleId: string, publicNotes: string) {
  await requireAuth()

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLead: { select: { id: true } } },
  })
  if (!vehicle) return { error: 'Vehículo no encontrado' }

  await db.vehicle.update({ where: { id: vehicleId }, data: { publicNotes } })

  revalidatePath(`/vendedores/${vehicle.sellerLead?.id}`)
  return { ok: true }
}
