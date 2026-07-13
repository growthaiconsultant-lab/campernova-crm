/**
 * PR5B3 — Núcleo transaccional del backfill legacy → DocumentVersion (PURO salvo `tx`).
 *
 * Convierte un documento legacy (raíz con `currentVersionId = null`, `versionSequence = 0`, `url`
 * = path u URL firmada antigua) en su VERSIÓN 1, reutilizando el object path existente. NO toca
 * Storage: no copia, mueve, descarga, re-sube, renombra ni borra objetos. Idempotente y seguro
 * ante concurrencia mediante compare-and-swap (mismo patrón que PR5B1). NO inventa metadata:
 * mimeType/sizeBytes/checksum/uploadedById/originalFilename quedan null salvo dato fiable.
 */
import type { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'

/** Conflicto de negocio esperado (concurrencia / estado desactualizado). NO error técnico. */
export class DocumentBackfillConflictError extends Error {
  readonly reason: string
  constructor(reason: string) {
    super(`Conflicto de backfill: ${reason}`)
    this.name = 'DocumentBackfillConflictError'
    this.reason = reason
  }
}

export type BackfillRootType = 'vehicle' | 'delivery'

/**
 * Ítem del plan de backfill (una raíz legacy migrable a versión 1). NO contiene la `url` legacy
 * cruda: para las URLs firmadas legacy eso incluiría el token, prohibido en planes/artefactos. El
 * CAS se basa en `(currentVersionId=null, versionSequence=0)` — invariante suficiente porque `url`
 * solo cambia cuando `currentVersionId` deja de ser null.
 */
export type BackfillPlanItem = {
  rootType: BackfillRootType
  rootId: string
  bucket: string
  objectPath: string
  /** Clasificación de origen (VALID_PATH | VALID_LEGACY_SIGNED_URL) — informativo. */
  sourceClassification: string
  /**
   * Valor legacy EXACTO de `url` a restaurar en un rollback, SOLO si se conserva de forma segura:
   *  - `VALID_PATH`: es el propio objectPath (sin token) → reversible exacto;
   *  - `VALID_LEGACY_SIGNED_URL`: `null` — la URL firmada original NO se conserva (contiene token),
   *    por lo que el rollback automático de esa fila queda BLOQUEADO (no se normaliza en silencio).
   */
  legacyUrl: string | null
  /** Metadata conocida de forma fiable (o null: no se inventa). */
  mimeType?: string | null
  sizeBytes?: number | null
  originalFilename?: string | null
}

export type BackfillOutcome =
  | { status: 'migrated'; versionId: string }
  | { status: 'skipped'; reason: string }

function ownerData(rootType: BackfillRootType, rootId: string) {
  return rootType === 'vehicle' ? { vehicleDocumentId: rootId } : { deliveryDocumentId: rootId }
}

function ownerWhere(rootType: BackfillRootType, rootId: string) {
  return rootType === 'vehicle' ? { vehicleDocumentId: rootId } : { deliveryDocumentId: rootId }
}

/**
 * Migra UNA raíz legacy a versión 1 dentro de `tx`. Reclama la raíz por CAS
 * `(id, currentVersionId=null, versionSequence=0, url=expectedUrl)`:
 *  - count 0 → la raíz ya se migró o cambió → `skipped` (idempotente, sin escribir metadata);
 *  - si el objectPath ya existe en otra versión → conflicto (revierte el CAS);
 *  - si no → crea DocumentVersion v1 (metadata desconocida = null), fija `currentVersionId` y
 *    sincroniza `url` con el objectPath (versionSequence ya quedó en 1 por el CAS).
 * NUNCA toca Storage.
 */
export async function backfillVersionTx(
  tx: Prisma.TransactionClient,
  item: BackfillPlanItem,
  hooks: { beforeCreate?: () => Promise<void> } = {}
): Promise<BackfillOutcome> {
  // CAS sobre el estado legacy. NO se incluye `url` (evita almacenar tokens de URLs firmadas):
  // `url` solo cambia cuando `currentVersionId` deja de ser null, así que este predicado ya
  // garantiza que la raíz no ha sido migrada ni recibido una subida real desde el plan.
  const where = {
    id: item.rootId,
    currentVersionId: null,
    versionSequence: 0,
  }
  const claim =
    item.rootType === 'vehicle'
      ? await tx.vehicleDocument.updateMany({ where, data: { versionSequence: 1 } })
      : await tx.deliveryDocument.updateMany({ where, data: { versionSequence: 1 } })

  if (claim.count === 0) {
    return { status: 'skipped', reason: 'no-longer-legacy-or-url-changed' }
  }

  await hooks.beforeCreate?.()

  // Belt-and-suspenders: el objectPath es único globalmente. Si ya existe, es conflicto
  // (otra raíz lo reclamó / doble referencia). Lanzar revierte el CAS de versionSequence.
  const existing = await tx.documentVersion.findUnique({
    where: { objectPath: item.objectPath },
    select: { id: true },
  })
  if (existing)
    throw new DocumentBackfillConflictError('objectPath ya referenciado por otra versión')

  let created: { id: string }
  try {
    created = await tx.documentVersion.create({
      data: {
        ...ownerData(item.rootType, item.rootId),
        version: 1,
        bucket: item.bucket,
        objectPath: item.objectPath,
        originalFilename: item.originalFilename ?? null,
        mimeType: item.mimeType ?? null,
        sizeBytes: item.sizeBytes ?? null,
        checksum: null,
        status: 'ACTIVE',
        uploadedById: null,
      },
    })
  } catch (err) {
    // Carrera: dos procesos migran raíces distintas con el MISMO objectPath; ambos ven `null` en
    // el pre-check y el perdedor choca con el unique de object_path (P2002). Es un CONFLICTO
    // controlado (no un error técnico): la transacción revierte y la raíz queda legacy.
    if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') {
      throw new DocumentBackfillConflictError('objectPath en conflicto (unique) por concurrencia')
    }
    throw err
  }

  if (item.rootType === 'vehicle') {
    await tx.vehicleDocument.update({
      where: { id: item.rootId },
      data: { currentVersionId: created.id, url: item.objectPath },
    })
  } else {
    await tx.deliveryDocument.update({
      where: { id: item.rootId },
      data: { currentVersionId: created.id, url: item.objectPath },
    })
  }

  return { status: 'migrated', versionId: created.id }
}

/**
 * Ítem de rollback: revierte SOLO una versión 1 creada por un backfill concreto. Restaura `url` a
 * su valor legacy EXACTO (`legacyUrl`). Si `legacyUrl` es `null` (la fila provino de una URL
 * firmada legacy cuyo token no se conserva), el rollback automático se BLOQUEA para no restaurar
 * una referencia distinta de la original.
 */
export type RollbackItem = {
  rootType: BackfillRootType
  rootId: string
  versionId: string
  objectPath: string
  legacyUrl: string | null
}

export type RollbackOutcome = { status: 'rolled_back' } | { status: 'skipped'; reason: string }

/**
 * Revierte una versión 1 creada por backfill dentro de `tx`, SOLO si el documento no ha
 * evolucionado: exactamente una versión, que es la esperada (v1, mismo objectPath), el puntero
 * sigue en ella y `versionSequence` sigue en 1. Restaura `url` legacy, anula el puntero y borra
 * la versión. NUNCA toca Storage. Si algo cambió → `skipped` (rechazo seguro).
 */
export async function rollbackVersionTx(
  tx: Prisma.TransactionClient,
  item: RollbackItem
): Promise<RollbackOutcome> {
  // Irreversible exacto (URL firmada legacy sin token conservado) → NO se revierte automáticamente.
  if (item.legacyUrl === null) {
    return {
      status: 'skipped',
      reason:
        'irreversible: la url legacy original (firmada) no se conserva; rollback automático bloqueado',
    }
  }

  const versions = await tx.documentVersion.findMany({
    where: ownerWhere(item.rootType, item.rootId),
    select: { id: true, version: true, objectPath: true },
  })
  if (versions.length !== 1) {
    return { status: 'skipped', reason: 'evolved: la raíz no tiene exactamente 1 versión' }
  }
  const v = versions[0]
  if (v.id !== item.versionId || v.version !== 1 || v.objectPath !== item.objectPath) {
    return { status: 'skipped', reason: 'evolved: la versión no coincide con la del plan' }
  }

  // CAS: el puntero debe seguir en la versión del backfill y la secuencia en 1. Restaura url legacy,
  // anula el puntero (libera la FK compuesta NO ACTION) y pone la secuencia a 0.
  const claim =
    item.rootType === 'vehicle'
      ? await tx.vehicleDocument.updateMany({
          where: { id: item.rootId, currentVersionId: item.versionId, versionSequence: 1 },
          data: { currentVersionId: null, versionSequence: 0, url: item.legacyUrl },
        })
      : await tx.deliveryDocument.updateMany({
          where: { id: item.rootId, currentVersionId: item.versionId, versionSequence: 1 },
          data: { currentVersionId: null, versionSequence: 0, url: item.legacyUrl },
        })
  if (claim.count === 0) {
    return { status: 'skipped', reason: 'evolved: currentVersionId/versionSequence cambiaron' }
  }

  await tx.documentVersion.delete({ where: { id: item.versionId } })
  return { status: 'rolled_back' }
}

// ── Plan hash + checkpoint ────────────────────────────────────────────────────

/**
 * Hash determinista y estable de un plan de backfill. Depende SOLO de los campos que definen la
 * operación (no del orden de entrada ni de timestamps). El mismo plan → el mismo hash.
 */
export function computePlanHash(items: BackfillPlanItem[]): string {
  const canonical = items
    .map((i) => ({
      rootType: i.rootType,
      rootId: i.rootId,
      bucket: i.bucket,
      objectPath: i.objectPath,
      version: 1,
    }))
    .sort((a, b) => `${a.rootType}:${a.rootId}`.localeCompare(`${b.rootType}:${b.rootId}`))
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

export type BackfillCheckpoint = {
  planHash: string
  env: string
  lastIndex: number
  migrated: number
  skipped: number
  conflicts: number
  errors: number
  timestamp: string
}

/**
 * Solo se permite reanudar si el plan (hash) y el entorno coinciden EXACTAMENTE con el checkpoint.
 * Evita reanudar con un plan distinto o en otro entorno.
 */
export function canResumeCheckpoint(
  checkpoint: BackfillCheckpoint,
  expected: { planHash: string; env: string }
): boolean {
  return checkpoint.planHash === expected.planHash && checkpoint.env === expected.env
}
