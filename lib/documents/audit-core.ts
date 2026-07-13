/**
 * PR5B3 — Núcleo de auditoría DB de documentos legacy (deps-inyectables, READ-ONLY).
 *
 * Lee las raíces (VehicleDocument / DeliveryDocument) con su versión actual y su nº de versiones,
 * clasifica cada una con `classifyLegacyDocument`, y produce agregados deterministas + un plan de
 * backfill (solo migrables). No escribe NADA. La capa de Prisma real (`prismaAuditDeps`) solo hace
 * `findMany` de solo lectura; los scripts la inyectan.
 */
import type { PrismaClient } from '@prisma/client'
import {
  classifyLegacyDocument,
  ALL_CLASSIFICATIONS,
  PRIVATE_DOCUMENTS_BUCKET,
  type LegacyClassification,
  type ClassificationResult,
} from './legacy-classification'
import type { BackfillPlanItem } from './backfill-core'

/** Fila mínima leída de una raíz (con su versión actual y su nº de versiones). */
export type AuditRootRow = {
  id: string
  url: string | null
  currentVersionId: string | null
  versionSequence: number
  versionCount: number
  currentVersion: {
    id: string
    version: number
    objectPath: string
    status: string
    ownerRootId: string | null
  } | null
}

export type AuditDeps = {
  listVehicleRoots: () => Promise<AuditRootRow[]>
  listDeliveryRoots: () => Promise<AuditRootRow[]>
}

/** Adaptador Prisma READ-ONLY (solo `findMany` con `select`). */
export function prismaAuditDeps(db: PrismaClient): AuditDeps {
  const select = {
    id: true,
    url: true,
    currentVersionId: true,
    versionSequence: true,
    _count: { select: { versions: true } },
    currentVersion: {
      select: { id: true, version: true, objectPath: true, status: true },
    },
  } as const

  const mapVehicle = (r: {
    id: string
    url: string | null
    currentVersionId: string | null
    versionSequence: number
    _count: { versions: number }
    currentVersion: { id: string; version: number; objectPath: string; status: string } | null
  }): AuditRootRow => ({
    id: r.id,
    url: r.url,
    currentVersionId: r.currentVersionId,
    versionSequence: r.versionSequence,
    versionCount: r._count.versions,
    // La versión actual pertenece a esta raíz por la FK compuesta; ownerRootId = r.id si existe.
    currentVersion: r.currentVersion ? { ...r.currentVersion, ownerRootId: r.id } : null,
  })

  return {
    listVehicleRoots: async () => (await db.vehicleDocument.findMany({ select })).map(mapVehicle),
    listDeliveryRoots: async () => (await db.deliveryDocument.findMany({ select })).map(mapVehicle),
  }
}

export type ClassifiedRow = {
  rootType: 'vehicle' | 'delivery'
  rootId: string
  result: ClassificationResult
}

export type AuditSummary = {
  totalVehicleDocuments: number
  totalDeliveryDocuments: number
  totalDocumentVersionsReferenced: number
  byClassification: Record<LegacyClassification, number>
  migratable: number
  blocked: number
  criticalInconsistencies: number
  alreadyStructured: number
}

export type AuditResult = {
  rows: ClassifiedRow[]
  summary: AuditSummary
}

/** Clasifica todas las raíces y agrega. No escribe nada. */
export async function auditLegacyDocuments(
  deps: AuditDeps,
  expectedBucket: string = PRIVATE_DOCUMENTS_BUCKET
): Promise<AuditResult> {
  const [vehicles, deliveries] = await Promise.all([
    deps.listVehicleRoots(),
    deps.listDeliveryRoots(),
  ])

  const rows: ClassifiedRow[] = []
  const classify = (rootType: 'vehicle' | 'delivery', r: AuditRootRow): ClassifiedRow => ({
    rootType,
    rootId: r.id,
    result: classifyLegacyDocument({
      rootType,
      rootId: r.id,
      url: r.url,
      currentVersionId: r.currentVersionId,
      versionSequence: r.versionSequence,
      versionCount: r.versionCount,
      currentVersion: r.currentVersion,
      expectedBucket,
    }),
  })

  for (const v of vehicles) rows.push(classify('vehicle', v))
  for (const d of deliveries) rows.push(classify('delivery', d))

  const byClassification = Object.fromEntries(ALL_CLASSIFICATIONS.map((c) => [c, 0])) as Record<
    LegacyClassification,
    number
  >
  for (const row of rows) byClassification[row.result.classification] += 1

  const summary: AuditSummary = {
    totalVehicleDocuments: vehicles.length,
    totalDeliveryDocuments: deliveries.length,
    totalDocumentVersionsReferenced:
      vehicles.reduce((n, r) => n + r.versionCount, 0) +
      deliveries.reduce((n, r) => n + r.versionCount, 0),
    byClassification,
    migratable: rows.filter((r) => r.result.migratable).length,
    blocked: rows.filter((r) => r.result.blocked).length,
    criticalInconsistencies: byClassification.ALREADY_VERSIONED_INCONSISTENT,
    alreadyStructured: byClassification.STRUCTURED,
  }

  return { rows, summary }
}

/**
 * Construye los ítems de backfill (SOLO migrables), con orden estable para un hash determinista.
 * No incluye la `url` legacy cruda (podría contener tokens de firma) — el objectPath es suficiente.
 */
export function buildBackfillPlanItems(rows: ClassifiedRow[]): BackfillPlanItem[] {
  const items: BackfillPlanItem[] = []
  for (const row of rows) {
    if (!row.result.migratable) continue
    if (!row.result.objectPath || !row.result.bucket) continue
    items.push({
      rootType: row.rootType,
      rootId: row.rootId,
      bucket: row.result.bucket,
      objectPath: row.result.objectPath,
      sourceClassification: row.result.classification,
      // Reversibilidad exacta: VALID_PATH conserva la url legacy (= objectPath, sin token) → se
      // puede restaurar exactamente. VALID_LEGACY_SIGNED_URL NO conserva el token → legacyUrl null
      // (rollback automático bloqueado, no se normaliza en silencio).
      legacyUrl: row.result.classification === 'VALID_PATH' ? row.result.objectPath : null,
      // Metadata NO inferida en el backfill DB (queda null).
      mimeType: null,
      sizeBytes: null,
      originalFilename: null,
    })
  }
  return items.sort((a, b) =>
    `${a.rootType}:${a.rootId}`.localeCompare(`${b.rootType}:${b.rootId}`)
  )
}
