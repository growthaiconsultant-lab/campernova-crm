'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, requireAgente } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  vehicleDocumentPath,
  vehicleDocumentSignedUrl,
  deleteVehicleDocumentFile,
} from '@/lib/supabase/storage'
import type { VehicleDocumentCategory } from '@prisma/client'

// ── Upload document ───────────────────────────────────────────────────────────

const uploadDocSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1).max(200),
  notes: z.string().max(500).optional(),
})

export async function uploadVehicleDocument(vehicleId: string, formData: FormData) {
  const actor = await requireAgente()

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { ok: false as const, error: 'Archivo requerido' }
  if (file.size > 10 * 1024 * 1024) return { ok: false as const, error: 'El archivo supera 10 MB' }

  const parsed = uploadDocSchema.safeParse({
    category: formData.get('category'),
    name: formData.get('name') || file.name,
    notes: formData.get('notes') || undefined,
  })
  if (!parsed.success) return { ok: false as const, error: 'Datos inválidos' }

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { ok: false as const, error: 'Vehículo no encontrado' }

  const ext = file.name.split('.').pop() ?? 'bin'
  const fileName = `${parsed.data.category}_${Date.now()}.${ext}`
  const path = vehicleDocumentPath(vehicleId, fileName)

  const supabase = createServerClient()
  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('vehicle-documents')
    .upload(path, bytes, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return { ok: false as const, error: 'Error al subir el archivo' }
  }

  const signedUrl = await vehicleDocumentSignedUrl(supabase, path, 3600 * 24 * 365)
  const urlToStore = signedUrl ?? path

  await db.$transaction([
    db.vehicleDocument.create({
      data: {
        vehicleId,
        category: parsed.data.category as VehicleDocumentCategory,
        name: parsed.data.name,
        url: urlToStore,
        fileSize: file.size,
        mimeType: file.type || null,
        notes: parsed.data.notes ?? null,
        uploadedById: actor.id,
      },
    }),
    db.activity.create({
      data: {
        type: 'DOCUMENTO_SUBIDO',
        content: `Documento subido: ${parsed.data.name} (${parsed.data.category})`,
        agentId: actor.id,
        sellerLeadId: vehicle.sellerLeadId,
      },
    }),
  ])

  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  return { ok: true as const }
}

// ── Delete document ───────────────────────────────────────────────────────────

export async function deleteVehicleDocument(documentId: string) {
  const actor = await requireAdmin()

  const doc = await db.vehicleDocument.findUnique({
    where: { id: documentId },
    include: { vehicle: { select: { sellerLeadId: true } } },
  })
  if (!doc) return { ok: false as const, error: 'Documento no encontrado' }

  const supabase = createServerClient()
  // Attempt to delete from storage (best-effort — URL may be external)
  const path = vehicleDocumentPath(doc.vehicleId, doc.url.split('/').pop() ?? '')
  await deleteVehicleDocumentFile(supabase, path).catch(console.error)

  await db.$transaction([
    db.vehicleDocument.delete({ where: { id: documentId } }),
    db.activity.create({
      data: {
        type: 'DOCUMENTO_ELIMINADO',
        content: `Documento eliminado: ${doc.name} (${doc.category})`,
        agentId: actor.id,
        sellerLeadId: doc.vehicle.sellerLeadId,
      },
    }),
  ])

  revalidatePath(`/vendedores/${doc.vehicle.sellerLeadId}`)
  return { ok: true as const }
}

// ── Update legal fields ───────────────────────────────────────────────────────

const legalFieldsSchema = z.object({
  plate: z.string().max(20).nullable().optional(),
  vin: z.string().max(50).nullable().optional(),
  itvValidUntil: z.string().nullable().optional(),
  titleTransferredAt: z.string().nullable().optional(),
})

export async function updateVehicleLegalFields(vehicleId: string, data: unknown) {
  const actor = await requireAdmin()

  const parsed = legalFieldsSchema.safeParse(data)
  if (!parsed.success) return { ok: false as const, error: 'Datos inválidos' }

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      sellerLeadId: true,
      plate: true,
      vin: true,
      itvValidUntil: true,
      titleTransferredAt: true,
    },
  })
  if (!vehicle) return { ok: false as const, error: 'Vehículo no encontrado' }

  const { plate, vin, itvValidUntil, titleTransferredAt } = parsed.data

  const activities: { type: string; content: string }[] = []

  if (plate !== undefined && plate !== vehicle.plate) {
    activities.push({
      type: 'MATRICULA_AÑADIDA',
      content: `Matrícula actualizada: ${plate ?? '(borrada)'}`,
    })
  }
  if (itvValidUntil !== undefined) {
    const newDate = itvValidUntil ? new Date(itvValidUntil) : null
    const oldDate = vehicle.itvValidUntil
    if (newDate?.getTime() !== oldDate?.getTime()) {
      activities.push({
        type: 'ITV_ACTUALIZADA',
        content: `ITV válida hasta: ${newDate ? newDate.toLocaleDateString('es-ES') : '(borrada)'}`,
      })
    }
  }
  if (titleTransferredAt !== undefined) {
    const newDate = titleTransferredAt ? new Date(titleTransferredAt) : null
    const oldDate = vehicle.titleTransferredAt
    if (newDate?.getTime() !== oldDate?.getTime() && newDate) {
      activities.push({
        type: 'TITULARIDAD_TRANSFERIDA',
        content: `Titularidad transferida el ${newDate.toLocaleDateString('es-ES')}`,
      })
    }
  }

  await db.$transaction([
    db.vehicle.update({
      where: { id: vehicleId },
      data: {
        plate: plate ?? null,
        vin: vin ?? null,
        itvValidUntil: itvValidUntil ? new Date(itvValidUntil) : null,
        titleTransferredAt: titleTransferredAt ? new Date(titleTransferredAt) : null,
      },
    }),
    ...activities.map((a) =>
      db.activity.create({
        data: {
          type: a.type as Parameters<typeof db.activity.create>[0]['data']['type'],
          content: a.content,
          agentId: actor.id,
          sellerLeadId: vehicle.sellerLeadId,
        },
      })
    ),
  ])

  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  return { ok: true as const }
}

// ── Mark charges checked ──────────────────────────────────────────────────────

export async function markChargesChecked(vehicleId: string, notes?: string) {
  const actor = await requireAdmin()

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { ok: false as const, error: 'Vehículo no encontrado' }

  const now = new Date()

  await db.$transaction([
    db.vehicle.update({
      where: { id: vehicleId },
      data: { chargeCheckedAt: now, chargeCheckedById: actor.id },
    }),
    db.activity.create({
      data: {
        type: 'CARGAS_VERIFICADAS',
        content: notes
          ? `Cargas DGT verificadas. Notas: ${notes}`
          : 'Cargas DGT verificadas sin incidencias',
        agentId: actor.id,
        sellerLeadId: vehicle.sellerLeadId,
      },
    }),
  ])

  revalidatePath(`/vendedores/${vehicle.sellerLeadId}`)
  return { ok: true as const }
}

// ── Get signed URL ────────────────────────────────────────────────────────────

export async function getVehicleDocumentSignedUrl(documentId: string) {
  await requireAgente()

  const doc = await db.vehicleDocument.findUnique({
    where: { id: documentId },
    select: { url: true },
  })
  if (!doc) return { ok: false as const, error: 'Documento no encontrado' }

  // If already a full signed URL return as-is; if it's a path regenerate
  if (doc.url.startsWith('http')) return { ok: true as const, url: doc.url }

  const supabase = createServerClient()
  const url = await vehicleDocumentSignedUrl(supabase, doc.url, 3600)
  if (!url) return { ok: false as const, error: 'Error al generar la URL' }

  return { ok: true as const, url }
}
