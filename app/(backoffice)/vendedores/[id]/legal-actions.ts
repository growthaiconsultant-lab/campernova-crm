'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, requireAgente } from '@/lib/auth'
// Documentos privados: el bucket es DENY-ALL para anon/authenticated (PR5B2). Las operaciones
// de Storage (subir/firmar/borrar) usan el cliente service_role SOLO servidor, tras autorizar
// con Prisma (requireAgente/requireAdmin) en esta misma Server Action.
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  VEHICLE_DOCUMENTS_BUCKET,
  vehicleDocumentSignedUrl,
  deleteVehicleDocumentFiles,
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
import {
  createFirstVersionTx,
  collectVersionObjects,
  detachAndDeleteRootTx,
} from '@/lib/storage/versioned-documents'
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
  const supabase = getSupabaseAdminClient()

  try {
    // Sube al bucket privado y persiste metadatos con compensación (sin objetos huérfanos).
    // Se guarda el PATH del objeto, nunca una URL firmada persistida.
    await uploadPrivateDocumentWithCompensation({
      storage: supabase.storage.from(VEHICLE_DOCUMENTS_BUCKET),
      path,
      bytes,
      contentType: file.type,
      persist: async () => {
        // Raíz lógica + DocumentVersion nº 1 + actividad, ATÓMICOS (transacción interactiva:
        // la versión referencia el id de la raíz recién creada). `createFirstVersionTx` fija
        // versionSequence=1, currentVersionId y sincroniza `url` con el objectPath.
        await db.$transaction(async (tx) => {
          const root = await tx.vehicleDocument.create({
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
          })
          await createFirstVersionTx(tx, 'vehicle', root.id, {
            bucket: VEHICLE_DOCUMENTS_BUCKET,
            objectPath: path,
            originalFilename: displayName,
            mimeType: file.type || null,
            sizeBytes: file.size,
            uploadedById: actor.id,
          })
          await tx.activity.create({
            data: {
              type: 'DOCUMENTO_SUBIDO',
              content: `Documento subido: ${displayName} (${parsed.data.category})`,
              agentId: actor.id,
              sellerLeadId: vehicle.sellerLeadId,
            },
          })
        })
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

  // Recolecta los objetos de TODAS las versiones (sin dejar huérfanos históricos). Si la fila es
  // legacy (sin versiones), cae al `url` legacy con la resolución estricta de PR5A. Si nada
  // resuelve de forma segura, no se borra a ciegas.
  const versionObjects = await collectVersionObjects(db, 'vehicle', documentId)
  let paths: string[]
  if (versionObjects.length > 0) {
    paths = versionObjects.map((v) => v.objectPath)
  } else {
    const legacyPath = extractVehicleDocumentPath(doc.url)
    if (!legacyPath) {
      return { ok: false as const, error: 'No se pudo resolver el documento para eliminarlo.' }
    }
    paths = [legacyPath]
  }

  // Semántica estricta: se borran PRIMERO los objetos; solo si Storage lo confirma se elimina el
  // registro (nunca se informa éxito con estado incierto ni se deja un objeto sin referencia).
  const supabase = getSupabaseAdminClient()
  const removed = await deleteVehicleDocumentFiles(supabase, paths)
  if (!removed) {
    return { ok: false as const, error: 'No se pudo eliminar el archivo del almacenamiento.' }
  }

  // Si la DB fallara aquí, los objetos ya no existen y el registro persiste (referencia colgante):
  // el error se propaga para observabilidad (estado incierto documentado, no huérfano silencioso).
  // `detachAndDeleteRootTx` anula el puntero y borra la raíz; las versiones caen por cascada.
  await db.$transaction(async (tx) => {
    await detachAndDeleteRootTx(tx, 'vehicle', documentId)
    await tx.activity.create({
      data: {
        type: 'DOCUMENTO_ELIMINADO',
        content: `Documento eliminado: ${doc.name} (${doc.category})`,
        agentId: actor.id,
        sellerLeadId: doc.vehicle.sellerLeadId,
      },
    })
  })

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
    select: { url: true, currentVersion: { select: { objectPath: true } } },
  })
  if (!doc) return { ok: false as const, error: 'Documento no encontrado' }

  // Se genera una URL firmada de corta duración desde el path resuelto (nunca se re-sirve una URL
  // almacenada). Prioridad: objectPath de la VERSIÓN ACTUAL (path interno ya seguro, generado
  // server-side). Fallback legacy: filas sin versiones → se extrae el path del `url` (compatible
  // con URLs firmadas de larga duración antiguas). Si nada resuelve de forma segura, se rechaza.
  const path = doc.currentVersion?.objectPath ?? extractVehicleDocumentPath(doc.url)
  if (!path) return { ok: false as const, error: 'No se pudo resolver el documento.' }

  const supabase = getSupabaseAdminClient()
  const url = await vehicleDocumentSignedUrl(supabase, path, PRIVATE_DOC_SIGNED_URL_TTL_SECONDS)
  if (!url) return { ok: false as const, error: 'Error al generar la URL' }

  return { ok: true as const, url }
}
