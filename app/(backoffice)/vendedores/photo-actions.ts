'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
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

  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } })
  if (!vehicle) return { error: 'Vehículo no encontrado' }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const filename = `${randomUUID()}.${ext}`
  const path = vehiclePhotoPath(vehicleId, filename)

  const supabase = createClient()
  const { error: uploadError } = await supabase.storage
    .from(VEHICLE_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return { error: `Error al subir: ${uploadError.message}` }
  }

  const url = vehiclePhotoPublicUrl(path)

  const last = await db.vehiclePhoto.findFirst({
    where: { vehicleId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const nextOrder = (last?.order ?? -1) + 1

  const photo = await db.vehiclePhoto.create({
    data: { vehicleId, url, order: nextOrder, category },
    select: { id: true, url: true, order: true, category: true },
  })

  const v = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (v) revalidatePath(`/vendedores/${v.sellerLeadId}`)

  return { photo }
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

  await db.vehiclePhoto.delete({ where: { id: photoId } })

  const v = await db.vehicle.findUnique({
    where: { id: photo.vehicleId },
    select: { sellerLeadId: true },
  })
  if (v) revalidatePath(`/vendedores/${v.sellerLeadId}`)

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

  if (photo.vehicle?.sellerLeadId) revalidatePath(`/vendedores/${photo.vehicle.sellerLeadId}`)
  return { ok: true }
}

export async function reorderVehiclePhotos(
  vehicleId: string,
  orderedIds: string[]
): Promise<Ok | ActionError> {
  await requireCanGenerateAds()

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { error: 'Orden inválido' }
  }

  const photos = await db.vehiclePhoto.findMany({
    where: { vehicleId },
    select: { id: true },
  })
  const existingIds = new Set(photos.map((p) => p.id))
  if (orderedIds.length !== photos.length || !orderedIds.every((id) => existingIds.has(id))) {
    return { error: 'IDs no coinciden con las fotos del vehículo' }
  }

  await db.$transaction(
    orderedIds.map((id, index) => db.vehiclePhoto.update({ where: { id }, data: { order: index } }))
  )

  const v = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (v) revalidatePath(`/vendedores/${v.sellerLeadId}`)

  return { ok: true }
}
