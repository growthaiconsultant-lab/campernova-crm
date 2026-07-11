'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, requireCanViewEntregas, requireCanEditEntregas } from '@/lib/auth'
import { completeDeliveryTx, DeliveryConflictError } from '@/lib/delivery-completion'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { VEHICLE_DOCUMENTS_BUCKET } from '@/lib/supabase/storage'
import {
  validateDocumentFile,
  safeDocumentObjectPath,
  normalizeDisplayName,
  DocumentValidationError,
} from '@/lib/storage/private-documents'
import {
  uploadPrivateDocumentWithCompensation,
  StorageOperationError,
} from '@/lib/storage/store-document'
import { sendDeliveryConfirmation } from '@/lib/email/send'
import type { DeliveryStatus, DeliveryDocumentCategory } from '@prisma/client'

const DELIVERY_DOC_CATEGORIES: readonly string[] = [
  'CONTRATO_FINAL',
  'FACTURA',
  'DOCUMENTO_ENTREGA',
  'FOTO_ENTREGA',
  'OTRO',
]

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const VALID_TRANSITIONS: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
  PROGRAMADA: ['EN_CURSO', 'CANCELADA'],
  EN_CURSO: ['COMPLETADA', 'CANCELADA'],
}

function isValidDeliveryTransition(from: DeliveryStatus, to: DeliveryStatus) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// 14-item checklist created with every delivery
const INITIAL_CHECKLIST = [
  { category: 'PRE_ENTREGA' as const, item: 'Limpieza final OK' },
  { category: 'PRE_ENTREGA' as const, item: 'Niveles revisados' },
  { category: 'PRE_ENTREGA' as const, item: 'Documentación preparada' },
  { category: 'PRE_ENTREGA' as const, item: 'Garantía preparada' },
  { category: 'PRE_ENTREGA' as const, item: 'Cita confirmada' },
  { category: 'EXPLICACION' as const, item: 'Explicar agua, gas y luz' },
  { category: 'EXPLICACION' as const, item: 'Explicar boiler/calefacción' },
  { category: 'EXPLICACION' as const, item: 'Explicar placas/baterías' },
  { category: 'EXPLICACION' as const, item: 'Prueba cierres y accesorios' },
  { category: 'EXPLICACION' as const, item: 'Resolver dudas cliente' },
  { category: 'FIRMA_SALIDA' as const, item: 'Contrato final' },
  { category: 'FIRMA_SALIDA' as const, item: 'Factura' },
  { category: 'FIRMA_SALIDA' as const, item: 'Documento entrega' },
  { category: 'FIRMA_SALIDA' as const, item: 'Fotos entrega' },
]

const createDeliverySchema = z.object({
  vehicleId: z.string().min(1),
  buyerLeadId: z.string().min(1),
  scheduledAt: z.string().min(1),
  responsableId: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

const signDeliverySchema = z.object({
  signedByName: z.string().min(1, 'Nombre requerido').trim(),
  signedByDni: z.string().min(1, 'DNI requerido').trim(),
  signatureUrl: z.string().min(1, 'Firma requerida'),
})

export async function createDelivery(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await requireCanViewEntregas()

  const parsed = createDeliverySchema.safeParse(formData)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  const { vehicleId, buyerLeadId, scheduledAt, responsableId, notes } = parsed.data

  const delivery = await db.delivery.create({
    data: {
      vehicleId,
      buyerLeadId,
      responsableId: responsableId ?? null,
      scheduledAt: new Date(scheduledAt),
      notes: notes ?? null,
      checklist: {
        create: INITIAL_CHECKLIST.map((c) => ({ ...c, result: 'PENDIENTE' as const })),
      },
    },
    include: {
      buyerLead: { select: { name: true, email: true } },
      vehicle: { select: { brand: true, model: true } },
    },
  })

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })

  await db.activity.create({
    data: {
      type: 'ENTREGA_PROGRAMADA',
      content: `Entrega programada para el ${new Date(scheduledAt).toLocaleDateString('es-ES')}`,
      agentId: actor.id,
      sellerLeadId: vehicle?.sellerLeadId ?? null,
      buyerLeadId,
    },
  })

  // Non-blocking confirmation email to buyer
  sendDeliveryConfirmation({
    buyerName: delivery.buyerLead.name,
    buyerEmail: delivery.buyerLead.email,
    vehicleLabel: `${delivery.vehicle.brand} ${delivery.vehicle.model}`,
    scheduledAt: new Date(scheduledAt),
    deliveryId: delivery.id,
  }).catch(console.error)

  revalidatePath('/entregas')
  return { ok: true, data: { id: delivery.id } }
}

export async function updateDeliveryStatus(
  deliveryId: string,
  newStatus: DeliveryStatus
): Promise<ActionResult> {
  const actor = await requireCanEditEntregas()

  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      status: true,
      vehicleId: true,
      buyerLeadId: true,
      signedByName: true,
      signedByDni: true,
      signatureUrl: true,
      vehicle: { select: { sellerLeadId: true } },
      checklist: { select: { result: true } },
    },
  })
  if (!delivery) return { ok: false, error: 'Entrega no encontrada' }

  if (!isValidDeliveryTransition(delivery.status, newStatus)) {
    return { ok: false, error: `Transición ${delivery.status} → ${newStatus} no permitida.` }
  }

  if (newStatus === 'COMPLETADA') {
    const pending = delivery.checklist.filter((c) => c.result === 'PENDIENTE')
    if (pending.length > 0) {
      return { ok: false, error: `Hay ${pending.length} ítems pendientes en el checklist.` }
    }
    if (!delivery.signedByName || !delivery.signedByDni || !delivery.signatureUrl) {
      return { ok: false, error: 'La entrega requiere firma antes de completarse.' }
    }
  }

  const now = new Date()

  if (newStatus === 'COMPLETADA') {
    // Finalización ATÓMICA: entrega + vehículo + comprador + match + garantía + seguimientos
    // + trazas en una única transacción. La disponibilidad se decide con compare-and-swap
    // dentro de la transacción (no con la lectura previa), evitando estados parciales.
    try {
      await db.$transaction((tx) =>
        completeDeliveryTx(tx, {
          deliveryId,
          vehicleId: delivery.vehicleId,
          buyerLeadId: delivery.buyerLeadId,
          sellerLeadId: delivery.vehicle.sellerLeadId,
          actorId: actor.id,
          now,
        })
      )
    } catch (err) {
      // Conflicto de negocio esperado (concurrencia / estado incompatible) → mensaje claro.
      if (err instanceof DeliveryConflictError) return { ok: false, error: err.message }
      // Error técnico inesperado → propágalo (no ocultarlo como conflicto).
      throw err
    }
  } else {
    // EN_CURSO / CANCELADA: transiciones sin garantía asociada.
    await db.$transaction(async (tx) => {
      await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          status: newStatus,
          ...(newStatus === 'EN_CURSO' && { startedAt: now }),
        },
      })
      if (newStatus === 'CANCELADA') {
        await tx.activity.create({
          data: {
            type: 'ENTREGA_CANCELADA',
            content: 'Entrega cancelada.',
            agentId: actor.id,
            sellerLeadId: delivery.vehicle.sellerLeadId,
            buyerLeadId: delivery.buyerLeadId,
          },
        })
      }
    })
  }

  revalidatePath('/entregas')
  revalidatePath(`/entregas/${deliveryId}`)
  revalidatePath(`/vendedores/${delivery.vehicle.sellerLeadId}`)
  revalidatePath(`/compradores/${delivery.buyerLeadId}`)
  return { ok: true }
}

export async function updateDeliveryChecklistItem(
  itemId: string,
  data: { result: string; notes?: string | null }
): Promise<ActionResult> {
  await requireCanEditEntregas()

  await db.deliveryChecklistItem.update({
    where: { id: itemId },
    data: {
      result: data.result as 'PENDIENTE' | 'OK' | 'INCIDENCIA' | 'NO_APLICA',
      notes: data.notes ?? null,
    },
  })

  const item = await db.deliveryChecklistItem.findUnique({
    where: { id: itemId },
    select: { deliveryId: true },
  })
  if (item) revalidatePath(`/entregas/${item.deliveryId}`)
  return { ok: true }
}

export async function signDelivery(deliveryId: string, formData: unknown): Promise<ActionResult> {
  const actor = await requireCanEditEntregas()

  const parsed = signDeliverySchema.safeParse(formData)
  if (!parsed.success) return { ok: false, error: 'Datos de firma inválidos' }

  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    select: { status: true, responsableId: true },
  })
  if (!delivery) return { ok: false, error: 'Entrega no encontrada' }
  if (delivery.status === 'COMPLETADA' || delivery.status === 'CANCELADA') {
    return { ok: false, error: 'La entrega ya está cerrada.' }
  }
  if (actor.role !== 'ADMIN' && delivery.responsableId !== actor.id) {
    return { ok: false, error: 'Solo el responsable de la entrega o un admin puede firmar.' }
  }

  const { signedByName, signedByDni, signatureUrl } = parsed.data

  await db.delivery.update({
    where: { id: deliveryId },
    data: { signedByName, signedByDni, signatureUrl },
  })

  revalidatePath(`/entregas/${deliveryId}`)
  return { ok: true }
}

export async function cancelDelivery(deliveryId: string, reason?: string): Promise<ActionResult> {
  return updateDeliveryStatus(deliveryId, 'CANCELADA').then((res) => {
    if (res.ok && reason) {
      db.delivery
        .update({ where: { id: deliveryId }, data: { cancellationReason: reason } })
        .catch(console.error)
    }
    return res
  })
}

/**
 * PR5: subida de documento de entrega SERVER-SIDE. Antes el navegador subía con la anon key
 * al bucket privado (sin validación) y pasaba el path elegido por el cliente. Ahora recibe el
 * archivo, valida MIME/extensión/tamaño en servidor, genera un object path seguro, sube con el
 * cliente de servidor y persiste con compensación (sin objetos huérfanos).
 */
export async function uploadDeliveryDocument(
  deliveryId: string,
  formData: FormData
): Promise<ActionResult> {
  const actor = await requireCanEditEntregas()

  const file = formData.get('file') as File | null
  if (!file) return { ok: false, error: 'Archivo requerido' }

  const categoryRaw = String(formData.get('category') ?? '')
  if (!DELIVERY_DOC_CATEGORIES.includes(categoryRaw)) {
    return { ok: false, error: 'Categoría no válida' }
  }
  const category = categoryRaw as DeliveryDocumentCategory

  let ext: string
  try {
    ext = validateDocumentFile({ mimeType: file.type, fileName: file.name, size: file.size }).ext
  } catch (err) {
    if (err instanceof DocumentValidationError) return { ok: false, error: err.message }
    throw err
  }

  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    select: { status: true },
  })
  if (!delivery) return { ok: false, error: 'Entrega no encontrada' }
  if (delivery.status === 'COMPLETADA' || delivery.status === 'CANCELADA') {
    return { ok: false, error: 'La entrega ya está cerrada.' }
  }

  const documentId = randomUUID()
  const path = safeDocumentObjectPath({
    prefix: 'deliveries',
    entityId: deliveryId,
    documentId,
    ext,
  })
  const displayName = normalizeDisplayName((formData.get('name') as string) || file.name)
  const bytes = await file.arrayBuffer()
  const supabase = createServerClient()

  try {
    await uploadPrivateDocumentWithCompensation({
      storage: supabase.storage.from(VEHICLE_DOCUMENTS_BUCKET),
      path,
      bytes,
      contentType: file.type,
      persist: async () => {
        await db.deliveryDocument.create({
          data: { deliveryId, category, name: displayName, url: path, uploadedById: actor.id },
        })
      },
    })
  } catch (err) {
    if (err instanceof StorageOperationError)
      return { ok: false, error: 'Error al subir el archivo' }
    throw err
  }

  revalidatePath(`/entregas/${deliveryId}`)
  return { ok: true }
}

export async function deleteDeliveryDocument(docId: string): Promise<ActionResult> {
  await requireAdmin()

  const doc = await db.deliveryDocument.findUnique({
    where: { id: docId },
    select: { url: true, deliveryId: true },
  })
  if (!doc) return { ok: false, error: 'Documento no encontrado' }

  // DeliveryDocument.url siempre es un object path interno. Guard defensivo contra traversal.
  if (!doc.url || doc.url.startsWith('/') || doc.url.includes('..')) {
    return { ok: false, error: 'No se pudo resolver el documento para eliminarlo.' }
  }

  // Semántica estricta: borra PRIMERO el objeto; solo si Storage lo confirma se elimina el
  // registro (no se informa éxito con estado incierto ni se deja un objeto sin referencia).
  const supabase = createServerClient()
  const { error } = await supabase.storage.from(VEHICLE_DOCUMENTS_BUCKET).remove([doc.url])
  if (error) {
    return { ok: false, error: 'No se pudo eliminar el archivo del almacenamiento.' }
  }

  await db.deliveryDocument.delete({ where: { id: docId } })
  revalidatePath(`/entregas/${doc.deliveryId}`)
  return { ok: true }
}
