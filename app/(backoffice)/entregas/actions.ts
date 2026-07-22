'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, requireCanEditEntregas } from '@/lib/auth'
import { completeDeliveryTx, DeliveryConflictError } from '@/lib/delivery-completion'
import { withLockedRoots, isLockError } from '@/lib/locking'
import {
  createDeliveryTx,
  buildDeliveryCreationRoots,
  isDeliveryCreationError,
  isPotentialActiveDeliveryVehicleConflict,
  ACTIVE_DELIVERY_STATUSES,
  DELIVERY_CREATION_ERROR_MESSAGES,
} from '@/lib/delivery-creation'
import {
  transitionDeliveryTx,
  isDeliveryTransitionError,
  DELIVERY_TRANSITION_ERROR_MESSAGES,
  type DeliveryTransitionSource,
  type DeliveryTransitionTarget,
} from '@/lib/delivery-transitions'
// Documentos privados de entrega: bucket DENY-ALL para anon/authenticated (PR5B2). Storage se
// opera con el cliente service_role SOLO servidor, tras autorizar con Prisma en la Server Action.
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { VEHICLE_DOCUMENTS_BUCKET, deleteVehicleDocumentFiles } from '@/lib/supabase/storage'
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
import {
  createFirstVersionTx,
  collectVersionObjects,
  detachAndDeleteRootTx,
} from '@/lib/storage/versioned-documents'
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
  // I3C1A: obligatorio. La columna es nullable solo para compatibilidad de rollout, pero el código
  // nuevo NUNCA crea una entrega sin una Offer CONVERTIDA.
  offerId: z.string().min(1),
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
  // I3C1A: pasa de permiso de LECTURA a permiso de EDICIÓN (era una escalada de privilegios).
  const actor = await requireCanEditEntregas()

  const parsed = createDeliverySchema.safeParse(formData)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  const { vehicleId, buyerLeadId, offerId, scheduledAt, responsableId, notes } = parsed.data

  // Lectura preliminar: solo resuelve identidades para las raíces. Ninguna decisión de negocio se
  // toma sobre estos datos; todo se relee dentro de la transacción.
  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { sellerLeadId: true },
  })
  if (!vehicle) return { ok: false, error: DELIVERY_CREATION_ERROR_MESSAGES.VEHICLE_NOT_FOUND }

  const roots = buildDeliveryCreationRoots({
    vehicleId,
    sellerLeadId: vehicle.sellerLeadId,
    buyerLeadId,
  })

  let created: { deliveryId: string }
  try {
    created = await withLockedRoots(roots, (tx) =>
      createDeliveryTx(tx, {
        vehicleId,
        buyerLeadId,
        offerId,
        resolvedSellerLeadId: vehicle.sellerLeadId,
        scheduledAt: new Date(scheduledAt),
        responsableId: responsableId ?? null,
        notes: notes ?? null,
        actorId: actor.id,
        checklist: INITIAL_CHECKLIST.map((c) => ({ category: c.category, item: c.item })),
      })
    )
  } catch (err) {
    if (isDeliveryCreationError(err)) return { ok: false, error: err.message }
    if (isLockError(err)) return { ok: false, error: err.message }
    // P2002 del índice único parcial de Delivery activa. Prisma NO devuelve el nombre del índice
    // (solo `modelName='Delivery'` + `target=['vehicle_id']`), así que la metadata identifica el
    // ÁREA probable y una lectura post-rollback CONFIRMA la causa comercial real. La consulta corre
    // FUERA de la transacción ya revertida (cliente global) — la transacción abortada no es usable.
    // Si no se confirma una activa real, se propaga el error técnico (no se inventa el conflicto).
    if (isPotentialActiveDeliveryVehicleConflict(err)) {
      const active = await db.delivery.count({
        where: { vehicleId, status: { in: ACTIVE_DELIVERY_STATUSES } },
      })
      if (active > 0) {
        return { ok: false, error: DELIVERY_CREATION_ERROR_MESSAGES.DELIVERY_ALREADY_ACTIVE }
      }
    }
    // Error técnico inesperado (o P2002 no confirmado) → propágalo.
    throw err
  }

  // Efectos post-commit: email de confirmación (no bloqueante) + revalidación.
  const detail = await db.delivery.findUnique({
    where: { id: created.deliveryId },
    select: {
      buyerLead: { select: { name: true, email: true } },
      vehicle: { select: { brand: true, model: true } },
    },
  })
  if (detail) {
    sendDeliveryConfirmation({
      buyerName: detail.buyerLead.name,
      buyerEmail: detail.buyerLead.email,
      vehicleLabel: `${detail.vehicle.brand} ${detail.vehicle.model}`,
      scheduledAt: new Date(scheduledAt),
      deliveryId: created.deliveryId,
    }).catch(console.error)
  }

  revalidatePath('/entregas')
  return { ok: true, data: { id: created.deliveryId } }
}

/**
 * I3C2 — núcleo compartido de transición coordinada (EN_CURSO / CANCELADA). Lectura preliminar solo
 * para resolver raíces → `withLockedRoots` (Vehicle → SellerLead → BuyerLead) → `transitionDeliveryTx`
 * (relee, valida, CAS, Activity atómica) → efectos post-commit. Un ÚNICO caller de `withLockedRoots`
 * para ambas acciones (no se duplica el protocolo). La COMPLECIÓN NO pasa por aquí (I3C3).
 */
async function runCoordinatedDeliveryTransition(params: {
  deliveryId: string
  targetStatus: DeliveryTransitionTarget
  expectedCurrentStatus?: DeliveryStatus
  cancellationReason?: string | null
  actorId: string
}): Promise<ActionResult> {
  const { deliveryId, targetStatus } = params

  const prelim = await db.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      status: true,
      vehicleId: true,
      buyerLeadId: true,
      vehicle: { select: { sellerLeadId: true } },
    },
  })
  if (!prelim) return { ok: false, error: DELIVERY_TRANSITION_ERROR_MESSAGES.DELIVERY_NOT_FOUND }

  // Estado esperado: el enviado por el cliente (defensa anti-obsoleto) o el observado ahora.
  const expected = params.expectedCurrentStatus ?? prelim.status
  if (expected !== 'PROGRAMADA' && expected !== 'EN_CURSO') {
    if (prelim.status === 'CANCELADA')
      return { ok: false, error: DELIVERY_TRANSITION_ERROR_MESSAGES.DELIVERY_ALREADY_CANCELLED }
    if (prelim.status === 'COMPLETADA')
      return { ok: false, error: DELIVERY_TRANSITION_ERROR_MESSAGES.DELIVERY_ALREADY_COMPLETED }
    return { ok: false, error: DELIVERY_TRANSITION_ERROR_MESSAGES.INVALID_DELIVERY_TRANSITION }
  }

  const roots = buildDeliveryCreationRoots({
    vehicleId: prelim.vehicleId,
    sellerLeadId: prelim.vehicle.sellerLeadId,
    buyerLeadId: prelim.buyerLeadId,
  })

  try {
    await withLockedRoots(roots, (tx) =>
      transitionDeliveryTx(tx, {
        deliveryId,
        vehicleId: prelim.vehicleId,
        buyerLeadId: prelim.buyerLeadId,
        resolvedSellerLeadId: prelim.vehicle.sellerLeadId,
        expectedCurrentStatus: expected as DeliveryTransitionSource,
        targetStatus,
        actorId: params.actorId,
        cancellationReason: params.cancellationReason ?? null,
        now: new Date(),
      })
    )
  } catch (err) {
    if (isDeliveryTransitionError(err)) return { ok: false, error: err.message }
    if (isLockError(err)) return { ok: false, error: err.message }
    throw err
  }

  revalidatePath('/entregas')
  revalidatePath(`/entregas/${deliveryId}`)
  revalidatePath(`/vendedores/${prelim.vehicle.sellerLeadId}`)
  revalidatePath(`/compradores/${prelim.buyerLeadId}`)
  return { ok: true }
}

export async function updateDeliveryStatus(
  deliveryId: string,
  newStatus: DeliveryStatus,
  expectedCurrentStatus?: DeliveryStatus
): Promise<ActionResult> {
  const actor = await requireCanEditEntregas()

  // EN_CURSO → transición coordinada I3C2. La cancelación va por `cancelDelivery` (exige motivo).
  if (newStatus === 'EN_CURSO') {
    return runCoordinatedDeliveryTransition({
      deliveryId,
      targetStatus: 'EN_CURSO',
      expectedCurrentStatus,
      actorId: actor.id,
    })
  }
  if (newStatus === 'CANCELADA') {
    // La cancelación requiere motivo: se enruta por la acción dedicada.
    return { ok: false, error: DELIVERY_TRANSITION_ERROR_MESSAGES.CANCELLATION_REASON_REQUIRED }
  }
  if (newStatus !== 'COMPLETADA') {
    return { ok: false, error: DELIVERY_TRANSITION_ERROR_MESSAGES.INVALID_DELIVERY_TRANSITION }
  }

  // COMPLETADA → permanece en la ruta de I3C3 (`completeDeliveryTx`), SIN cambios en esta fase.
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

  const pending = delivery.checklist.filter((c) => c.result === 'PENDIENTE')
  if (pending.length > 0) {
    return { ok: false, error: `Hay ${pending.length} ítems pendientes en el checklist.` }
  }
  if (!delivery.signedByName || !delivery.signedByDni || !delivery.signatureUrl) {
    return { ok: false, error: 'La entrega requiere firma antes de completarse.' }
  }

  const now = new Date()
  // Finalización ATÓMICA: entrega + vehículo + comprador + match + garantía + seguimientos + trazas
  // en una única transacción, con compare-and-swap (I3C3 añadirá el protocolo de locks).
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
    if (err instanceof DeliveryConflictError) return { ok: false, error: err.message }
    throw err
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

export async function cancelDelivery(
  deliveryId: string,
  reason: string,
  expectedCurrentStatus?: DeliveryStatus
): Promise<ActionResult> {
  const actor = await requireCanEditEntregas()
  // El motivo se valida (no vacío) dentro del núcleo y se escribe ATÓMICO con estado + Activity.
  return runCoordinatedDeliveryTransition({
    deliveryId,
    targetStatus: 'CANCELADA',
    expectedCurrentStatus,
    cancellationReason: reason,
    actorId: actor.id,
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
  const supabase = getSupabaseAdminClient()

  try {
    await uploadPrivateDocumentWithCompensation({
      storage: supabase.storage.from(VEHICLE_DOCUMENTS_BUCKET),
      path,
      bytes,
      contentType: file.type,
      persist: async () => {
        // Raíz lógica + DocumentVersion nº 1, ATÓMICOS (transacción interactiva: la versión
        // referencia el id de la raíz recién creada). Fija versionSequence=1, currentVersionId
        // y sincroniza `url` con el objectPath.
        await db.$transaction(async (tx) => {
          const root = await tx.deliveryDocument.create({
            data: { deliveryId, category, name: displayName, url: path, uploadedById: actor.id },
          })
          await createFirstVersionTx(tx, 'delivery', root.id, {
            bucket: VEHICLE_DOCUMENTS_BUCKET,
            objectPath: path,
            originalFilename: displayName,
            mimeType: file.type || null,
            sizeBytes: file.size,
            uploadedById: actor.id,
          })
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

  // Recolecta los objetos de TODAS las versiones (sin dejar huérfanos históricos). Si la fila es
  // legacy (sin versiones), cae al `url` legacy, que siempre es un object path interno.
  const versionObjects = await collectVersionObjects(db, 'delivery', docId)
  let paths: string[]
  if (versionObjects.length > 0) {
    paths = versionObjects.map((v) => v.objectPath)
  } else {
    // Guard defensivo contra traversal (DeliveryDocument.url siempre es un object path interno).
    if (!doc.url || doc.url.startsWith('/') || doc.url.includes('..')) {
      return { ok: false, error: 'No se pudo resolver el documento para eliminarlo.' }
    }
    paths = [doc.url]
  }

  // Semántica estricta: borra PRIMERO los objetos; solo si Storage lo confirma se elimina el
  // registro (no se informa éxito con estado incierto ni se deja un objeto sin referencia).
  const supabase = getSupabaseAdminClient()
  const removed = await deleteVehicleDocumentFiles(supabase, paths)
  if (!removed) {
    return { ok: false, error: 'No se pudo eliminar el archivo del almacenamiento.' }
  }

  // `detachAndDeleteRootTx` anula el puntero y borra la raíz; las versiones caen por cascada.
  await db.$transaction(async (tx) => {
    await detachAndDeleteRootTx(tx, 'delivery', docId)
  })
  revalidatePath(`/entregas/${doc.deliveryId}`)
  return { ok: true }
}
