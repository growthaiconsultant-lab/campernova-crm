'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, requireAgente } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  VEHICLE_DOCUMENTS_BUCKET,
  vehicleDocumentSignedUrl,
  deleteVehicleDocumentFile,
  extractVehicleDocumentPath,
} from '@/lib/supabase/storage'
import {
  validateDocumentFile,
  safeDocumentObjectPath,
  normalizeDisplayName,
  DocumentValidationError,
  PRIVATE_DOC_SIGNED_URL_TTL_SECONDS,
} from '@/lib/storage/private-documents'
import {
  uploadPrivateDocumentWithCompensation,
  StorageOperationError,
} from '@/lib/storage/store-document'
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
  if (!file) return { ok: false as const, error: 'Archivo requerido' }

  // Validación server-side (MIME/extensión/tamaño/nombre): no se confía en el navegador.
  let ext: string
  try {
    ext = validateDocumentFile({ mimeType: file.type, fileName: file.name, size: file.size }).ext
  } catch (err) {
    if (err instanceof DocumentValidationError) return { ok: false as const, error: err.message }
    throw err
  }

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

  // Object path interno seguro (server-side): sin nombre del usuario, sin PII, sin traversal.
  const documentId = randomUUID()
  const path = safeDocumentObjectPath({ prefix: 'docs', entityId: vehicleId, documentId, ext })
  const displayName = normalizeDisplayName(parsed.data.name)
  const bytes = await file.arrayBuffer()
  const supabase = createServerClient()

  try {
    // Sube al bucket privado y persiste metadatos con compensación (sin objetos huérfanos).
    // Se guarda el PATH del objeto, nunca una URL firmada persistida.
    await uploadPrivateDocumentWithCompensation({
      storage: supabase.storage.from(VEHICLE_DOCUMENTS_BUCKET),
      path,
      bytes,
      contentType: file.type,
      persist: async () => {
        await db.$transaction([
          db.vehicleDocument.create({
            data: {
              vehicleId,
              category: parsed.data.category as VehicleDocumentCategory,
              name: displayName,
              url: path,
              fileSize: file.size,
              mimeType: file.type || null,
              notes: parsed.data.notes ?? null,
              uploadedById: actor.id,
            },
          }),
          db.activity.create({
            data: {
              type: 'DOCUMENTO_SUBIDO',
              content: `Documento subido: ${displayName} (${parsed.data.category})`,
              agentId: actor.id,
              sellerLeadId: vehicle.sellerLeadId,
            },
          }),
        ])
      },
    })
  } catch (err) {
    if (err instanceof StorageOperationError) {
      return { ok: false as const, error: 'Error al subir el archivo' }
    }
    throw err
  }

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

  // Resuelve el object path real (path directo o extraído de una URL legacy). Si no se puede
  // resolver de forma segura, no se borra a ciegas: se devuelve error (no se orphanea el objeto).
  const path = extractVehicleDocumentPath(doc.url)
  if (!path) {
    return { ok: false as const, error: 'No se pudo resolver el documento para eliminarlo.' }
  }

  // Semántica estricta: se borra PRIMERO el objeto; solo si Storage lo confirma se elimina el
  // registro (nunca se informa éxito con estado incierto ni se deja un objeto sin referencia).
  const supabase = createServerClient()
  const removed = await deleteVehicleDocumentFile(supabase, path)
  if (!removed) {
    return { ok: false as const, error: 'No se pudo eliminar el archivo del almacenamiento.' }
  }

  // Si la DB fallara aquí, el objeto ya no existe y el registro persiste (referencia colgante):
  // el error se propaga para observabilidad (estado incierto documentado, no huérfano silencioso).
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

  // Siempre se genera una URL firmada de corta duración desde el path resuelto (nunca se
  // re-sirve la URL almacenada). Compatible con filas legacy que guardaban una URL firmada
  // de larga duración: se extrae su path y se vuelve a firmar en corto. Si no resuelve a un
  // path seguro (dominio externo/otro bucket/malformada), se rechaza.
  const path = extractVehicleDocumentPath(doc.url)
  if (!path) return { ok: false as const, error: 'No se pudo resolver el documento.' }

  const supabase = createServerClient()
  const url = await vehicleDocumentSignedUrl(supabase, path, PRIVATE_DOC_SIGNED_URL_TTL_SECONDS)
  if (!url) return { ok: false as const, error: 'Error al generar la URL' }

  return { ok: true as const, url }
}
