/**
 * PR5B3 — Generador de PLAN de backfill (READ-ONLY: no escribe en DB).
 *
 * Audita la DB, selecciona SOLO las raíces migrables (VALID_PATH / VALID_LEGACY_SIGNED_URL) y
 * escribe un plan JSON con hash estable en `.artifacts/document-migration/` (gitignored). El plan
 * contiene rootId + objectPath reales (necesarios para aplicar) pero NUNCA la url legacy cruda
 * (evita tokens de firma). La salida por consola va redactada.
 *
 * Uso: pnpm documents:plan-backfill -- --env local [--out <dir>]
 * Exit: 0 OK · 1 guard/config · 2 conexión/consulta.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parseCliFlags, readEnvSelector } from '../lib/documents/cli-support'
import { resolveMigrationTarget, MigrationGuardError } from '../lib/documents/migration-env-guard'
import {
  auditLegacyDocuments,
  prismaAuditDeps,
  buildBackfillPlanItems,
} from '../lib/documents/audit-core'
import { computePlanHash } from '../lib/documents/backfill-core'
import { redactId, redactSecretsInText } from '../lib/documents/migration-redaction'

const ARTIFACT_DIR = join('.artifacts', 'document-migration')

async function main(): Promise<number> {
  const flags = parseCliFlags(process.argv.slice(2))
  const env = readEnvSelector(flags)

  let url: string
  try {
    // Generar el plan es read-only → operación 'audit'.
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
    const { rows, summary } = await auditLegacyDocuments(prismaAuditDeps(prisma))
    const items = buildBackfillPlanItems(rows)
    const planHash = computePlanHash(items)

    const blocked = rows
      .filter((r) => r.result.blocked)
      .map((r) => ({
        rootType: r.rootType,
        rootId: redactId(r.rootId), // bloqueados van redactados (no se aplican)
        classification: r.result.classification,
        reason: r.result.reason,
      }))

    const plan = {
      tool: 'plan-document-backfill',
      version: 1,
      env,
      planHash,
      generatedAt: new Date().toISOString(),
      schemaCommit: process.env.GITHUB_SHA ?? 'unknown',
      itemCount: items.length,
      blockedCount: blocked.length,
      summary,
      // Ítems aplicables: rootId + objectPath REALES (el artefacto es gitignored). Sin url cruda.
      items,
      // Bloqueados: solo referencia redactada, para revisión humana.
      blocked,
    }

    const outDir = typeof flags.out === 'string' ? flags.out : ARTIFACT_DIR
    mkdirSync(outDir, { recursive: true })
    const file = join(outDir, `backfill-plan-${env}-${planHash.slice(0, 12)}.json`)
    writeFileSync(file, JSON.stringify(plan, null, 2), { encoding: 'utf8', mode: 0o600 })

    console.log(
      `plan-document-backfill: OK — plan con ${items.length} ítem(s) migrable(s), ${blocked.length} bloqueado(s).`
    )
    console.log(`plan-document-backfill: planHash=${planHash}`)
    console.log(`plan-document-backfill: escrito en ${file} (gitignored, permisos 600).`)
    return 0
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`plan-document-backfill: error — ${redactSecretsInText(message)}`)
    return 2
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`plan-document-backfill: error inesperado — ${redactSecretsInText(message)}`)
    process.exit(2)
  })
