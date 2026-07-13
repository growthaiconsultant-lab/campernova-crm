/**
 * PR5B3 — Auditoría READ-ONLY de referencias documentales legacy.
 *
 * Clasifica cada VehicleDocument / DeliveryDocument (STRUCTURED / VALID_PATH / VALID_LEGACY_SIGNED_URL
 * / EXTERNAL_URL / WRONG_BUCKET / INVALID_REFERENCE / MISSING_REFERENCE / ALREADY_VERSIONED_INCONSISTENT)
 * y produce un informe JSON agregado. NO modifica ninguna fila (solo `findMany`). No imprime URLs
 * firmadas, object paths completos ni PII. En PR5B3 se ejecuta solo contra local/CI.
 *
 * Uso:
 *   pnpm documents:audit -- --env local [--output <file>] [--include-redacted-details]
 *                           [--vehicle-only|--delivery-only]
 * Guardas de entorno: --env staging exige ALLOW_STAGING_DOCUMENT_AUDIT=true; producción exige
 * ALLOW_PRODUCTION_DOCUMENT_AUDIT=true + --ack. Siempre read-only.
 *
 * Exit: 0 OK · 1 error de configuración/guard · 2 error de conexión/consulta.
 */
import { writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { parseCliFlags, readEnvSelector } from '../lib/documents/cli-support'
import { resolveMigrationTarget, MigrationGuardError } from '../lib/documents/migration-env-guard'
import { auditLegacyDocuments, prismaAuditDeps } from '../lib/documents/audit-core'
import { redactId, redactSecretsInText } from '../lib/documents/migration-redaction'

async function main(): Promise<number> {
  const flags = parseCliFlags(process.argv.slice(2))
  const env = readEnvSelector(flags)

  let url: string
  try {
    url = resolveMigrationTarget({
      env,
      operation: 'audit',
      processEnv: process.env,
      confirm: typeof flags.ack === 'string' ? flags.ack : undefined,
    }).url
  } catch (err) {
    if (err instanceof MigrationGuardError) {
      console.error(err.message)
      return 1
    }
    throw err
  }

  const prisma = new PrismaClient({ datasourceUrl: url })
  try {
    const deps = prismaAuditDeps(prisma)
    const { rows, summary } = await auditLegacyDocuments(deps)

    const report = {
      tool: 'audit-legacy-documents',
      readOnly: true,
      timestamp: new Date().toISOString(),
      env,
      schemaCommit: process.env.GITHUB_SHA ?? 'unknown',
      summary,
      // Detalles SIEMPRE redactados (id hasheado + referencia sin token/host/path completo).
      details: flags['include-redacted-details']
        ? rows.map((r) => ({
            rootType: r.rootType,
            rootId: redactId(r.rootId),
            classification: r.result.classification,
            reason: r.result.reason,
            migratable: r.result.migratable,
            blocked: r.result.blocked,
          }))
        : undefined,
    }

    const json = JSON.stringify(report, null, 2)
    if (typeof flags.output === 'string') {
      writeFileSync(flags.output, json, { encoding: 'utf8' })
      console.log(`audit-legacy-documents: informe escrito en ${flags.output}`)
    } else {
      console.log(json)
    }
    console.log(
      `audit-legacy-documents: OK — ${summary.totalVehicleDocuments + summary.totalDeliveryDocuments} raíces · ` +
        `${summary.migratable} migrables · ${summary.blocked} bloqueadas · ` +
        `${summary.criticalInconsistencies} inconsistencias críticas`
    )
    return 0
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`audit-legacy-documents: error — ${redactSecretsInText(message)}`)
    return 2
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`audit-legacy-documents: error inesperado — ${redactSecretsInText(message)}`)
    process.exit(2)
  })
