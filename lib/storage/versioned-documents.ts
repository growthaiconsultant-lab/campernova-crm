/**
 * PR5B1 — Modelo documental versionado (Opción C).
 *
 * Servicio interno de versionado de documentos privados. NO importa React/Next ni ejecuta
 * `revalidatePath`: solo lógica de dominio + acceso a DB (vía `tx` inyectada) y, en la capa
 * alta, al Storage acotado a un bucket (`BucketScopedStorage`). Testeable con Postgres real
 * (integración) y con fakes (unidad).
 *
 * Modelo (ver `prisma/schema.prisma`):
 *  - `VehicleDocument` / `DeliveryDocument` son las RAÍCES lógicas (una por documento).
 *  - `DocumentVersion` es cada archivo físico. Pertenece a EXACTAMENTE una raíz (XOR) por FK.
 *  - La versión ACTUAL la determina el puntero `currentVersionId` de la raíz. Una FK COMPUESTA
 *    `(id, currentVersionId) → (rootId, versionId)` garantiza en Postgres que la actual
 *    pertenece a esa misma raíz. No hay `isCurrent` redundante.
 *  - `versionSequence` en la raíz es el contador monotónico usado para el compare-and-swap
 *    (CAS) que reclama la raíz antes de insertar una versión nueva (evita insertar dos veces
 *    el mismo número de versión y traducir un P2002 en conflicto).
 *
 * El objeto físico histórico SIEMPRE se conserva: un reemplazo nunca sobrescribe un objectPath
 * ni borra el objeto anterior. `url` (legacy) se sincroniza con el objectPath de la versión
 * actual por compatibilidad con lecturas antiguas.
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import { type BucketScopedStorage, StorageOperationError } from './store-document'

/** Conflicto de negocio esperado por concurrencia / estado desactualizado (NO error técnico). */
export class DocumentVersionConflictError extends Error {
  constructor(
    message = 'El documento ha cambiado; recarga y vuelve a intentarlo (conflicto de versión).'
  ) {
    super(message)
    this.name = 'DocumentVersionConflictError'
  }
}

/** Raíz lógica a la que pertenece una versión. */
export type DocRootType = 'vehicle' | 'delivery'

/** Metadatos físicos de una versión nueva. `checksum` es opcional (no se calcula en PR5B1). */
export type NewVersionInput = {
  bucket: string
  objectPath: string
  originalFilename?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  checksum?: string | null
  uploadedById?: string | null
}

/** Valores esperados de la raíz para el CAS de reemplazo. */
export type ReplaceExpectation = {
  versionSequence: number
  currentVersionId: string | null
}

/** Semillas de test para forzar la carrera del CAS de forma determinista (sin efecto en prod). */
export type ReplaceHooks = {
  beforeClaim?: () => Promise<void>
}

/**
 * Cliente DB mínimo para las funciones de alto nivel (solo requiere `$transaction`).
 * Estructural → los tests pueden inyectar un fake sin Prisma real.
 */
export type VersioningDb = {
  $transaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>
}

function versionOwnerData(rootType: DocRootType, rootId: string) {
  return rootType === 'vehicle' ? { vehicleDocumentId: rootId } : { deliveryDocumentId: rootId }
}

function versionData(
  rootType: DocRootType,
  rootId: string,
  version: number,
  input: NewVersionInput
) {
  return {
    ...versionOwnerData(rootType, rootId),
    version,
    bucket: input.bucket,
    objectPath: input.objectPath,
    originalFilename: input.originalFilename ?? null,
    mimeType: input.mimeType ?? null,
    sizeBytes: input.sizeBytes ?? null,
    checksum: input.checksum ?? null,
    status: 'ACTIVE' as const,
    uploadedById: input.uploadedById ?? null,
  }
}

/**
 * Crea la VERSIÓN 1 para una raíz recién creada (currentVersionId = null, versionSequence = 0)
 * dentro de `tx`. Orden compatible con la FK compuesta: primero se inserta la versión (que ya
 * apunta a la raíz existente), luego se actualiza el puntero de la raíz. Sincroniza `url`.
 *
 * Debe invocarse DESPUÉS de crear la fila raíz en la MISMA transacción.
 */
export async function createFirstVersionTx(
  tx: Prisma.TransactionClient,
  rootType: DocRootType,
  rootId: string,
  input: NewVersionInput
): Promise<{ versionId: string; version: number }> {
  const created = await tx.documentVersion.create({
    data: versionData(rootType, rootId, 1, input),
  })

  if (rootType === 'vehicle') {
    await tx.vehicleDocument.update({
      where: { id: rootId },
      data: { currentVersionId: created.id, versionSequence: 1, url: input.objectPath },
    })
  } else {
    await tx.deliveryDocument.update({
      where: { id: rootId },
      data: { currentVersionId: created.id, versionSequence: 1, url: input.objectPath },
    })
  }

  return { versionId: created.id, version: 1 }
}

/**
 * Reemplaza la versión actual de una raíz EXISTENTE dentro de `tx`, usando compare-and-swap.
 *
 * Reclama la raíz ANTES de insertar la versión nueva (sección 3.3): un `updateMany` condicional
 * sobre `(id, versionSequence, currentVersionId)` incrementa `versionSequence`. Si afecta 0 filas
 * (otra transacción ganó la carrera o los valores esperados están desactualizados) lanza
 * `DocumentVersionConflictError` ANTES de crear metadata → el perdedor no deja versión huérfana y
 * la capa alta compensa su objeto. El `UPDATE` condicional adquiere el lock de fila: el perdedor
 * espera, reevalúa tras el commit del ganador y obtiene `count === 0`.
 *
 * NO toca Storage: conserva el objeto anterior. Marca la versión anterior como `REPLACED`.
 */
export async function replaceVersionTx(
  tx: Prisma.TransactionClient,
  rootType: DocRootType,
  rootId: string,
  expected: ReplaceExpectation,
  input: NewVersionInput,
  now: Date,
  hooks: ReplaceHooks = {}
): Promise<{ versionId: string; version: number; previousVersionId: string | null }> {
  const nextSeq = expected.versionSequence + 1

  // Punto de sincronización de tests: fuerza a que ambas transacciones lleguen juntas al CAS.
  await hooks.beforeClaim?.()

  // CAS: reclama la raíz. La condición incluye `currentVersionId` para detectar también un
  // puntero desactualizado (no solo una secuencia obsoleta). En Prisma, `currentVersionId: null`
  // se traduce a `IS NULL`.
  const claim =
    rootType === 'vehicle'
      ? await tx.vehicleDocument.updateMany({
          where: {
            id: rootId,
            versionSequence: expected.versionSequence,
            currentVersionId: expected.currentVersionId,
          },
          data: { versionSequence: nextSeq },
        })
      : await tx.deliveryDocument.updateMany({
          where: {
            id: rootId,
            versionSequence: expected.versionSequence,
            currentVersionId: expected.currentVersionId,
          },
          data: { versionSequence: nextSeq },
        })

  if (claim.count === 0) throw new DocumentVersionConflictError()

  // Reclamada la raíz: nadie más puede crear esta misma versión.
  const created = await tx.documentVersion.create({
    data: versionData(rootType, rootId, nextSeq, input),
  })

  // Marca la versión anterior como reemplazada (si existía). Nunca se borra ni se toca su objeto.
  if (expected.currentVersionId) {
    await tx.documentVersion.update({
      where: { id: expected.currentVersionId },
      data: { status: 'REPLACED', replacedAt: now },
    })
  }

  // Puntero → versión nueva + sincroniza `url` (legacy) con el objectPath ganador.
  if (rootType === 'vehicle') {
    await tx.vehicleDocument.update({
      where: { id: rootId },
      data: { currentVersionId: created.id, url: input.objectPath },
    })
  } else {
    await tx.deliveryDocument.update({
      where: { id: rootId },
      data: { currentVersionId: created.id, url: input.objectPath },
    })
  }

  return { versionId: created.id, version: nextSeq, previousVersionId: expected.currentVersionId }
}

/**
 * Reemplazo de alto nivel: sube el objeto NUEVO (upsert:false) y persiste la versión con CAS y
 * compensación. Si el CAS pierde (conflicto) o la DB falla, elimina el objeto recién subido
 * (best-effort) y propaga el error original. El objeto anterior SIEMPRE se conserva.
 *
 * Los efectos externos (revalidate, actividad, email) NO van aquí: los ejecuta el llamador.
 */
export async function replaceCurrentVersion(
  deps: { db: VersioningDb; storage: BucketScopedStorage; now: Date },
  params: {
    rootType: DocRootType
    rootId: string
    expected: ReplaceExpectation
    upload: { bytes: ArrayBuffer; contentType: string }
    meta: NewVersionInput
    hooks?: ReplaceHooks
  }
): Promise<{ versionId: string; version: number; previousVersionId: string | null }> {
  const { error } = await deps.storage.upload(params.meta.objectPath, params.upload.bytes, {
    contentType: params.upload.contentType,
    upsert: false,
  })
  if (error) throw new StorageOperationError('No se pudo subir el archivo.')

  try {
    return await deps.db.$transaction((tx) =>
      replaceVersionTx(
        tx,
        params.rootType,
        params.rootId,
        params.expected,
        params.meta,
        deps.now,
        params.hooks
      )
    )
  } catch (err) {
    // Compensación del objeto perdedor/fallido: se elimina SOLO el objeto recién subido.
    // Nunca se toca el objeto de la versión anterior. Propaga el error original (conflicto o técnico).
    await deps.storage.remove([params.meta.objectPath]).catch(() => {})
    throw err
  }
}

// ── Lectura / contexto ──────────────────────────────────────────────────────────

/** Cliente de lectura: `PrismaClient` (Server Actions) o el mismo en integración. */
type VersioningReadDb = Pick<
  PrismaClient,
  'vehicleDocument' | 'deliveryDocument' | 'documentVersion'
>

export type ResolvedObject = { bucket: string; objectPath: string }

/**
 * Devuelve el `{ bucket, objectPath }` de la versión ACTUAL de la raíz, o `null` si la raíz no
 * existe o no tiene versión actual (fila legacy → el llamador cae al fallback de `url`).
 * NO crea metadata ni modifica `url` (la lectura no muta nada).
 */
export async function resolveCurrentObject(
  db: VersioningReadDb,
  rootType: DocRootType,
  rootId: string
): Promise<ResolvedObject | null> {
  const root =
    rootType === 'vehicle'
      ? await db.vehicleDocument.findUnique({
          where: { id: rootId },
          include: { currentVersion: { select: { bucket: true, objectPath: true } } },
        })
      : await db.deliveryDocument.findUnique({
          where: { id: rootId },
          include: { currentVersion: { select: { bucket: true, objectPath: true } } },
        })

  const current = root?.currentVersion
  if (!current) return null
  return { bucket: current.bucket, objectPath: current.objectPath }
}

/** Fila de historial de versión (subconjunto seguro para listar). */
export type VersionHistoryRow = {
  id: string
  version: number
  bucket: string
  objectPath: string
  status: string
  createdAt: Date
  replacedAt: Date | null
  deletedAt: Date | null
}

/**
 * Lista el historial de versiones de una raíz. `order` explícito ('desc' por defecto = la más
 * reciente primero). No es obligatorio exponerlo en UI en PR5B1.
 */
export async function listVersions(
  db: VersioningReadDb,
  rootType: DocRootType,
  rootId: string,
  order: 'asc' | 'desc' = 'desc'
): Promise<VersionHistoryRow[]> {
  const where =
    rootType === 'vehicle' ? { vehicleDocumentId: rootId } : { deliveryDocumentId: rootId }
  const rows = await db.documentVersion.findMany({
    where,
    orderBy: { version: order },
    select: {
      id: true,
      version: true,
      bucket: true,
      objectPath: true,
      status: true,
      createdAt: true,
      replacedAt: true,
      deletedAt: true,
    },
  })
  return rows
}

/**
 * Recolecta los objectPaths de TODAS las versiones de una raíz (para borrar el documento
 * completo sin dejar objetos huérfanos). Vacío si la raíz es legacy sin versiones — en ese
 * caso el llamador cae al `url` legacy (semántica estricta de PR5A).
 */
export async function collectVersionObjects(
  db: VersioningReadDb,
  rootType: DocRootType,
  rootId: string
): Promise<ResolvedObject[]> {
  const where =
    rootType === 'vehicle' ? { vehicleDocumentId: rootId } : { deliveryDocumentId: rootId }
  const rows = await db.documentVersion.findMany({
    where,
    select: { bucket: true, objectPath: true },
  })
  return rows.map((r) => ({ bucket: r.bucket, objectPath: r.objectPath }))
}

// ── Borrado ─────────────────────────────────────────────────────────────────────

/**
 * Elimina la raíz lógica y (por cascada) sus versiones, dentro de `tx`. Primero anula
 * `currentVersionId` para liberar la FK compuesta NO ACTION (evita cualquier violación al
 * cascar la versión aún referenciada), luego borra la raíz. Debe invocarse SOLO tras confirmar
 * el borrado físico de los objetos en Storage (lo orquesta la Server Action).
 */
export async function detachAndDeleteRootTx(
  tx: Prisma.TransactionClient,
  rootType: DocRootType,
  rootId: string
): Promise<void> {
  if (rootType === 'vehicle') {
    await tx.vehicleDocument.update({ where: { id: rootId }, data: { currentVersionId: null } })
    await tx.vehicleDocument.delete({ where: { id: rootId } })
  } else {
    await tx.deliveryDocument.update({ where: { id: rootId }, data: { currentVersionId: null } })
    await tx.deliveryDocument.delete({ where: { id: rootId } })
  }
}

/**
 * Regla de dominio PR5B1: una versión ACTUAL no se puede marcar como eliminada. Marca una
 * versión HISTÓRICA como `DELETED` (sin borrar físicamente el objeto). Lanza
 * `DocumentVersionConflictError` si se intenta eliminar la actual. No promociona otra versión.
 *
 * `currentVersionId` es el puntero actual de la raíz (lo lee/pasa el llamador).
 */
export async function markHistoricalVersionDeletedTx(
  tx: Prisma.TransactionClient,
  args: { versionId: string; currentVersionId: string | null; now: Date }
): Promise<void> {
  if (args.versionId === args.currentVersionId) {
    throw new DocumentVersionConflictError('No se puede eliminar la versión actual del documento.')
  }
  await tx.documentVersion.update({
    where: { id: args.versionId },
    data: { status: 'DELETED', deletedAt: args.now },
  })
}
