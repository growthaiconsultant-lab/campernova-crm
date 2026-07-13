/**
 * PR5B3 — Auditoría READ-ONLY de objetos de Storage vs referencias DB.
 *
 * Recorre `vehicle-documents` (BFS paginado), lo cruza con las referencias conocidas en DB
 * (DocumentVersion.objectPath + paths legacy resolubles) y clasifica: referenced / storage-only
 * (huérfano candidato, NO se elimina) / wrong-prefix / db-only (referencia rota). NO descarga
 * contenido, NO firma URLs, NO borra/mueve/copia. Informe redactado.
 *
 * Uso: pnpm documents:audit-storage -- --env local [--include-lead-documents]
 */
import { PrismaClient } from '@prisma/client'
import { parseCliFlags, readEnvSelector } from '../lib/documents/cli-support'
import { resolveStorageTarget, MigrationGuardError } from '../lib/documents/migration-env-guard'
import { getSupabaseAdminClient } from '../lib/supabase/admin'
import { VEHICLE_DOCUMENTS_BUCKET } from '../lib/supabase/storage'
import { parseLegacyReference } from '../lib/documents/legacy-classification'
import { listAllObjectPaths, crossReferenceStorage } from '../lib/documents/storage-audit-core'
import { redactObjectPath, redactSecretsInText } from '../lib/documents/migration-redaction'

async function collectReferencedPaths(prisma: PrismaClient): Promise<Set<string>> {
  const referenced = new Set<string>()
  // 1) Paths de versiones reales.
  const versions = await prisma.documentVersion.findMany({ select: { objectPath: true } })
  for (const v of versions) referenced.add(v.objectPath)
  // 2) Paths legacy resolubles (raíces sin versiones): path directo o URL firmada del bucket esperado.
  const legacyVehicles = await prisma.vehicleDocument.findMany({
    where: { currentVersionId: null },
    select: { url: true },
  })
  const legacyDeliveries = await prisma.deliveryDocument.findMany({
    where: { currentVersionId: null },
    select: { url: true },
  })
  for (const { url } of [...legacyVehicles, ...legacyDeliveries]) {
    const parsed = parseLegacyReference(url)
    if (parsed.kind === 'path' || parsed.kind === 'signed_url') referenced.add(parsed.objectPath)
  }
  return referenced
}

async function main(): Promise<number> {
  const flags = parseCliFlags(process.argv.slice(2))
  const env = readEnvSelector(flags)

  try {
    resolveStorageTarget({
      env,
      operation: 'audit',
      processEnv: process.env,
      confirm: typeof flags.ack === 'string' ? flags.ack : undefined,
    })
  } catch (err) {
    if (err instanceof MigrationGuardError) {
      console.error(err.message)
      return 1
    }
    throw err
  }

  const prisma = new PrismaClient()
  try {
    const admin = getSupabaseAdminClient()
    const bucket = admin.storage.from(VEHICLE_DOCUMENTS_BUCKET)
    const list = (prefix: string, opts: { limit: number; offset: number }) =>
      bucket.list(prefix, opts)

    const { paths, limitations } = await listAllObjectPaths(list)
    const referenced = await collectReferencedPaths(prisma)
    const summary = crossReferenceStorage(paths, referenced, limitations)

    const storageOnlySamples = paths
      .filter((p) => !referenced.has(p))
      .slice(0, 20)
      .map(redactObjectPath)

    const report = {
      tool: 'audit-document-storage',
      readOnly: true,
      timestamp: new Date().toISOString(),
      env,
      bucket: VEHICLE_DOCUMENTS_BUCKET,
      summary,
      storageOnlyOrphanSamples: storageOnlySamples,
    }
    console.log(JSON.stringify(report, null, 2))

    if (flags['include-lead-documents']) {
      const leadList = admin.storage.from('lead-documents').list('', { limit: 1, offset: 0 })
      const { error } = await leadList
      console.log(
        `audit-document-storage: lead-documents ${error ? 'no accesible/ausente' : 'presente (deprecado; ver reconciliación)'}`
      )
    }

    console.log(
      `audit-document-storage: OK — ${summary.totalStorageObjects} objeto(s) · ` +
        `${summary.referenced} referenciados · ${summary.storageOnlyOrphans} huérfanos candidatos · ` +
        `${summary.wrongPrefix} prefijo inesperado · ${summary.dbOnlyBrokenReferences} referencias rotas` +
        (limitations.truncatedAtMaxObjects || limitations.maxDepthReached
          ? ' · ⚠ cobertura NO completa (truncado)'
          : '')
    )
    return 0
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`audit-document-storage: error — ${redactSecretsInText(message)}`)
    return 2
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`audit-document-storage: error inesperado — ${redactSecretsInText(message)}`)
    process.exit(2)
  })
