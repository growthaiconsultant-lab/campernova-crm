'use server'
import { createHash, randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { operationalWritesPaused, OPS1_PAUSED_MESSAGE } from '@/lib/operations-control'
import {
  OPERATIONAL_DOCUMENT_ROLES,
  OPERATIONAL_DOCUMENT_CATEGORIES,
} from '@/lib/operations-policy'
import { operationalTargetSchema, documentTargetWhere } from '@/lib/operations-input'
import {
  operationalDocumentInput,
  validateOperationalFile,
  createOperationalDocumentTx,
} from '@/lib/operational-documents'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { safeDocumentObjectPath, DocumentValidationError } from '@/lib/storage/private-documents'
import {
  MAX_OPERATIONAL_DOCUMENT_BYTES,
  OPERATIONAL_STORAGE_TIMEOUT_MS,
} from '@/lib/operations-limits'
import { OperationalError, operationFingerprint } from '@/lib/operational-deliveries'
import { withLockedRoots, isLockError } from '@/lib/locking'

export async function listOperationalDocuments(raw: unknown, page = 0) {
  await requireRole(OPERATIONAL_DOCUMENT_ROLES)
  const target = operationalTargetSchema.safeParse(raw)
  if (!target.success || !Number.isInteger(page) || page < 0 || page > 10000)
    return { ok: false as const, error: 'Destino inválido.' }
  try {
    const rows = await db.vehicleDocument.findMany({
      where: {
        ...documentTargetWhere(target.data),
        category: { in: [...OPERATIONAL_DOCUMENT_CATEGORIES] },
      },
      select: { id: true, name: true, category: true, createdAt: true, fileSize: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 21,
      skip: page * 20,
    })
    return {
      ok: true as const,
      items: rows.slice(0, 20).map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      hasMore: rows.length > 20,
    }
  } catch {
    return { ok: false as const, error: 'No se pudieron cargar los documentos.' }
  }
}
export async function openOperationalDocument(id: string, raw: unknown) {
  await requireRole(OPERATIONAL_DOCUMENT_ROLES)
  const target = operationalTargetSchema.safeParse(raw)
  if (!target.success || !id || id.length > 100)
    return { ok: false as const, error: 'Documento inválido.' }
  try {
    const doc = await db.vehicleDocument.findFirst({
      where: {
        id,
        ...documentTargetWhere(target.data),
        category: { in: [...OPERATIONAL_DOCUMENT_CATEGORIES] },
      },
      select: { currentVersion: { select: { bucket: true, objectPath: true, status: true } } },
    })
    if (
      !doc?.currentVersion ||
      doc.currentVersion.bucket !== 'vehicle-documents' ||
      doc.currentVersion.status !== 'ACTIVE'
    )
      return { ok: false as const, error: 'Documento no disponible en este destino.' }
    const { data, error } = await getSupabaseAdminClient({
      timeoutMs: OPERATIONAL_STORAGE_TIMEOUT_MS,
    })
      .storage.from('vehicle-documents')
      .createSignedUrl(doc.currentVersion.objectPath, 300, { download: true })
    if (error || !data?.signedUrl)
      return { ok: false as const, error: 'No se pudo preparar la descarga.' }
    return { ok: true as const, url: data.signedUrl }
  } catch {
    return { ok: false as const, error: 'No se pudo preparar la descarga.' }
  }
}
export async function uploadOperationalDocument(raw: unknown, fd: FormData) {
  const actor = await requireRole(OPERATIONAL_DOCUMENT_ROLES)
  if (operationalWritesPaused()) return { ok: false as const, error: OPS1_PAUSED_MESSAGE }
  const parsed = operationalDocumentInput.safeParse(raw)
  if (!parsed.success)
    return { ok: false as const, error: 'Selecciona destino, categoría y nombre del documento.' }
  const input = parsed.data,
    file = fd.get('file')
  if (!(file instanceof File) || file.size > MAX_OPERATIONAL_DOCUMENT_BYTES)
    return { ok: false as const, error: 'Selecciona un archivo de hasta 3 MiB.' }
  let path: string | undefined
  try {
    const bytes = await file.arrayBuffer(),
      { ext } = validateOperationalFile(
        { mimeType: file.type, fileName: file.name, size: file.size },
        new Uint8Array(bytes)
      )
    const checksum = createHash('sha256').update(new Uint8Array(bytes)).digest('hex')
    const fingerprint = operationFingerprint({ input, checksum, mime: file.type, size: file.size })
    const creationKey = `${actor.id}:${input.operationId}`
    const previous = await db.vehicleDocument.findUnique({
      where: { creationKey },
      select: { id: true, creationFingerprint: true },
    })
    if (previous) {
      if (previous.creationFingerprint !== fingerprint)
        throw new OperationalError('La solicitud ya se utilizó con otro archivo o destino.')
      return { ok: true as const, id: previous.id }
    }
    // Comprueba existencia antes de cualquier uso privilegiado de Storage, sin gates comerciales.
    const exists =
      input.target.type === 'vehicle'
        ? await db.vehicle.count({ where: { id: input.target.id } })
        : input.target.type === 'buyerLead'
          ? await db.buyerLead.count({ where: { id: input.target.id } })
          : await db.sellerLead.count({ where: { id: input.target.id } })
    if (!exists) throw new OperationalError('El destino seleccionado no existe.')
    path = safeDocumentObjectPath({
      prefix: 'operational',
      entityId: input.target.id,
      documentId: randomUUID(),
      ext,
    })
    const storage = getSupabaseAdminClient({
      timeoutMs: OPERATIONAL_STORAGE_TIMEOUT_MS,
    }).storage.from('vehicle-documents')
    const uploaded = await storage.upload(path, bytes, { contentType: file.type, upsert: false })
    if (uploaded.error)
      throw new OperationalError('No se pudo subir el archivo. Reintenta con el mismo documento.')
    const uploadedPath = path
    let result: { id: string; path: string }
    try {
      result = await withLockedRoots([{ type: input.target.type, id: input.target.id }], (tx) =>
        createOperationalDocumentTx(tx, input, actor.id, {
          path: uploadedPath,
          size: file.size,
          mime: file.type,
          checksum,
          fingerprint,
        })
      )
    } catch (error) {
      // Reconciliar antes de compensar: un commit confirmado pero sin respuesta no debe perder su archivo.
      const saved = await db.vehicleDocument.findUnique({
        where: { creationKey },
        select: { id: true, url: true, creationFingerprint: true },
      })
      if (saved?.url !== uploadedPath) {
        const removed = await storage.remove([uploadedPath])
        if (removed.error) console.error('[OPS1] document_compensation_failed')
      }
      if (saved?.creationFingerprint === fingerprint) return { ok: true as const, id: saved.id }
      throw error
    }
    if (result.path !== uploadedPath) {
      const removed = await storage.remove([uploadedPath])
      if (removed.error) console.error('[OPS1] document_compensation_failed')
    }
    revalidatePath('/operaciones/documentos')
    revalidatePath('/vendedores/[id]', 'page')
    revalidatePath('/compradores/[id]', 'page')
    return { ok: true as const, id: result.id }
  } catch (error) {
    if (
      error instanceof OperationalError ||
      error instanceof DocumentValidationError ||
      isLockError(error)
    )
      return { ok: false as const, error: error.message }
    console.error('[OPS1] document_upload_failed')
    return {
      ok: false as const,
      error:
        'No se pudo confirmar la subida. Conserva el archivo y reintenta sin cambiar la solicitud.',
    }
  }
}
