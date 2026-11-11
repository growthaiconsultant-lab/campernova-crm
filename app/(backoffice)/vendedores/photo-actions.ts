'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { withLockedRoots } from '@/lib/locking/with-locked-roots'
import { revalidatePublicCatalog } from '@/lib/revalidate-public-catalog'
import { db } from '@/lib/db'
import { requireCanGenerateAds } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  VEHICLE_PHOTOS_BUCKET,
  extractVehiclePhotoPath,
  vehiclePhotoPath,
  vehiclePhotoPublicUrl,
} from '@/lib/supabase/storage'
import type { PhotoCategory } from '@prisma/client'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB — bucket limit

// PUB-1: categorías válidas de foto. Cualquier otro valor (o ausencia) → null (sin categoría).
const PHOTO_CATEGORIES: readonly PhotoCategory[] = ['EXTERIOR', 'INTERIOR', 'DETALLE', 'DOCUMENTAL']
function parsePhotoCategory(v: unknown): PhotoCategory | null {
  return typeof v === 'string' && PHOTO_CATEGORIES.includes(v as PhotoCategory)
    ? (v as PhotoCategory)
    : null
}

type ActionError = { error: string }
type UploadOk = {
  photo: { id: string; url: string; order: number; category: PhotoCategory | null }
}
type Ok = { ok: true }

function refreshPhotos(sellerId: string) {
  revalidatePath('/vendedores/' + sellerId)
  revalidatePath('/vehiculos')
  revalidatePublicCatalog()
}

export async function listVehiclePhotos(vehicleId: string) {
  await requireCanGenerateAds()
  return db.vehiclePhoto.findMany({
    where: { vehicleId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: { id: true, url: true, order: true, category: true, altText: true },
  })
}

export async function uploadVehiclePhoto(formData: FormData): Promise<UploadOk | ActionError> {
  await requireCanGenerateAds()

  const vehicleId = formData.get('vehicleId')
  const file = formData.get('file')
  const category = parsePhotoCategory(formData.get('category'))

  if (typeof vehicleId !== 'string' || !vehicleId) {
    return { error: 'Vehicle ID inválido' }
  }
  if (!(file instanceof File)) {
    return { error: 'Archivo no recibido' }
  }
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return { error: 'Formato no permitido. Usa JPEG, PNG o WebP.' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'El archivo supera 2 MB. Comprime la imagen.' }
  }

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { error: 'Vehículo no encontrado' }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const filename = `${randomUUID()}.${ext}`
  const path = vehiclePhotoPath(vehicleId, filename)
  const url = vehiclePhotoPublicUrl(path)

  const supabase = createClient()
  const { error: uploadError } = await supabase.storage
    .from(VEHICLE_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return { error: `Error al subir: ${uploadError.message}` }
  }

  try {
    const photo = await withLockedRoots([{ type: 'vehicle', id: vehicleId }], async (tx) => {
      if ((await tx.vehiclePhoto.count({ where: { vehicleId } })) >= 30) return null
      const last = await tx.vehiclePhoto.aggregate({ where: { vehicleId }, _max: { order: true } })
      return tx.vehiclePhoto.create({
        data: { vehicleId, url, order: (last._max.order ?? -1) + 1, category },
        select: { id: true, url: true, order: true, category: true, altText: true },
      })
    })
    if (photo) {
      refreshPhotos(vehicle.sellerLeadId)
      return { photo }
    }
  } catch (error) {
    // Una escritura con resultado incierto puede haberse confirmado.
    const saved = await db.vehiclePhoto.findFirst({
      where: { vehicleId, url },
      select: { id: true, url: true, order: true, category: true, altText: true },
    })
    if (saved) {
      refreshPhotos(vehicle.sellerLeadId)
      return { photo: saved }
    }
    await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).remove([path])
    throw error
  }
  await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).remove([path])
  return { error: 'Has alcanzado el máximo de 30 fotos.' }
}

export async function deleteVehiclePhoto(photoId: string): Promise<Ok | ActionError> {
  await requireCanGenerateAds()

  const photo = await db.vehiclePhoto.findUnique({
    where: { id: photoId },
    select: { id: true, url: true, vehicleId: true },
  })
  if (!photo) return { error: 'Foto no encontrada' }

  const path = extractVehiclePhotoPath(photo.url)
  if (path) {
    const supabase = createClient()
    const { error: removeError } = await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).remove([path])
    if (removeError) {
      return { error: `Error al eliminar del storage: ${removeError.message}` }
    }
  }

  await withLockedRoots([{ type: 'vehicle', id: photo.vehicleId }], (tx) =>
    tx.vehiclePhoto.deleteMany({ where: { id: photoId, vehicleId: photo.vehicleId } })
  )

  const v = await db.vehicle.findUnique({
    where: { id: photo.vehicleId },
    select: { sellerLeadId: true },
  })
  if (v) refreshPhotos(v.sellerLeadId)

  return { ok: true }
}

/**
 * PUB-1: fija/limpia la categoría de una foto. Resuelve Photo → Vehicle → SellerLead para revalidar
 * la ficha (el `photoId` no trae el `sellerLeadId`). `null` limpia la categoría (queda sin clasificar).
 */
export async function setVehiclePhotoCategory(
  photoId: string,
  category: PhotoCategory | null
): Promise<Ok | ActionError> {
  await requireCanGenerateAds()

  const parsed = category === null ? null : parsePhotoCategory(category)
  if (category !== null && parsed === null) return { error: 'Categoría no válida' }

  const photo = await db.vehiclePhoto.findUnique({
    where: { id: photoId },
    select: { id: true, vehicle: { select: { sellerLeadId: true } } },
  })
  if (!photo) return { error: 'Foto no encontrada' }

  await db.vehiclePhoto.update({ where: { id: photoId }, data: { category: parsed } })

  if (photo.vehicle?.sellerLeadId) refreshPhotos(photo.vehicle.sellerLeadId)
  return { ok: true }
}

export async function reorderVehiclePhotos(
  vehicleId: string,
  orderedIds: string[],
  previousIds?: string[]
): Promise<Ok | ActionError> {
  await requireCanGenerateAds()

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { error: 'Orden inválido' }
  }

  const changed = await withLockedRoots([{ type: 'vehicle', id: vehicleId }], async (tx) => {
    const photos = await tx.vehiclePhoto.findMany({
      where: { vehicleId },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: { id: true },
    })
    const ids = new Set(orderedIds)
    if (
      ids.size !== orderedIds.length ||
      photos.length !== ids.size ||
      photos.some((p) => !ids.has(p.id))
    )
      return false
    if (photos.every((p, i) => p.id === orderedIds[i])) return true
    if (
      previousIds &&
      (previousIds.length !== photos.length || photos.some((p, i) => previousIds[i] !== p.id))
    )
      return false
    for (let index = 0; index < orderedIds.length; index++)
      await tx.vehiclePhoto.update({ where: { id: orderedIds[index] }, data: { order: index } })
    return true
  })
  if (!changed) return { error: 'La galería ha cambiado. Revisa las fotos y vuelve a ordenarlas.' }
  const v = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (v) refreshPhotos(v.sellerLeadId)

  return { ok: true }
}
