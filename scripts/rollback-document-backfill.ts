/**
 * PR5B3 — Rollback LIMITADO del backfill. DRY-RUN POR DEFECTO. No se ejecuta en PR5B3.
 *
 * Solo revierte versiones 1 creadas por un plan concreto y SOLO si el documento no evolucionó
 * (una única versión, que es la v1 con el objectPath del plan, puntero y versionSequence intactos).
 * Restaura `url` al objectPath canónico (sin token), anula el puntero y borra la versión. NUNCA
 * toca Storage. Cualquier documento evolucionado se rechaza (skipped).
 *
 * Para revertir exige: --apply --plan <file> --plan-hash <hash> --env <env>
 *   --confirm ROLLBACK_DOCUMENT_BACKFILL (+ allow-var / --ack). Sin ello → dry-run.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { parseCliFlags, readEnvSelector } from '../lib/documents/cli-support'
import { resolveMigrationTarget, MigrationGuardError } from '../lib/documents/migration-env-guard'
import {
  rollbackVersionTx,
  computePlanHash,
  type BackfillPlanItem,
} from '../lib/documents/backfill-core'
import { redactId, redactSecretsInText } from '../lib/documents/migration-redaction'

const CONFIRM_TOKEN = 'ROLLBACK_DOCUMENT_BACKFILL'

async function main(): Promise<number> {
  const flags = parseCliFlags(process.argv.slice(2))
  const env = readEnvSelector(flags)
  if (typeof flags.plan !== 'string') {
    console.error('rollback-document-backfill: falta --plan <file>.')
    return 1
  }
  const parsed = JSON.parse(readFileSync(flags.plan, 'utf8'))
  const items = parsed.items as BackfillPlanItem[]
  const planHash = computePlanHash(items)
  if (parsed.planHash !== planHash) {
    console.error('rollback-document-backfill: el plan ha sido alterado (hash). Aborta.')
    return 1
  }

  const isApply = flags.apply === true
  if (!isApply) {
    console.log('rollback-document-backfill: DRY-RUN (no se revierte nada).')
    console.log(`  plan: ${items.length} ítem(s), planHash=${planHash}, env=${env}`)
    console.log(
      `  Para revertir: --apply --plan <file> --plan-hash ${planHash} --env ${env} --confirm ${CONFIRM_TOKEN} (+ allow-var / --ack).`
    )
    return 0
  }
  if (flags['plan-hash'] !== planHash) {
    console.error('rollback-document-backfill: --plan-hash no coincide. Aborta.')
    return 1
  }
  if (flags.confirm !== CONFIRM_TOKEN) {
    console.error(`rollback-document-backfill: se requiere --confirm ${CONFIRM_TOKEN}.`)
    return 1
  }

  let url: string
  try {
    url = resolveMigrationTarget({
      env,
      operation: 'backfill',
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
  const counters = { rolledBack: 0, skipped: 0, errors: 0 }
  try {
    for (const item of items) {
      // Deriva el versionId a revertir del estado ACTUAL (el que apunta la raíz). rollbackVersionTx
      // re-valida que sea la v1 del backfill y que no haya evolucionado.
      const root =
        item.rootType === 'vehicle'
          ? await prisma.vehicleDocument.findUnique({
              where: { id: item.rootId },
              select: { currentVersionId: true },
            })
          : await prisma.deliveryDocument.findUnique({
              where: { id: item.rootId },
              select: { currentVersionId: true },
            })
      if (!root?.currentVersionId) {
        counters.skipped++
        continue
      }
      try {
        const res = await prisma.$transaction((tx) =>
          rollbackVersionTx(tx, {
            rootType: item.rootType,
            rootId: item.rootId,
            versionId: root.currentVersionId!,
            objectPath: item.objectPath,
            // Restaura el valor legacy EXACTO; null (URL firmada legacy) → rollback bloqueado.
            legacyUrl: item.legacyUrl,
          })
        )
        if (res.status === 'rolled_back') counters.rolledBack++
        else counters.skipped++
      } catch {
        counters.errors++
        console.error(`  error revirtiendo ${item.rootType} ${redactId(item.rootId)}`)
      }
    }
    console.log(
      `rollback-document-backfill: FIN — revertidos=${counters.rolledBack} omitidos=${counters.skipped} errores=${counters.errors}.`
    )
    return counters.errors > 0 ? 2 : 0
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`rollback-document-backfill: error — ${redactSecretsInText(message)}`)
    return 2
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`rollback-document-backfill: error inesperado — ${redactSecretsInText(message)}`)
    process.exit(2)
  })
