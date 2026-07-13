/**
 * PR5B3 — Aplicación del backfill legacy → DocumentVersion. DISEÑADO PARA ESCRITURA, pero
 * DRY-RUN POR DEFECTO. No se ejecuta contra staging/producción en PR5B3.
 *
 * Para escribir exige SIMULTÁNEAMENTE:
 *   --apply  --plan <file>  --plan-hash <hash>  --env <env>  --confirm APPLY_DOCUMENT_BACKFILL
 * y, según el entorno, la variable de autorización (ALLOW_STAGING/PRODUCTION_DOCUMENT_BACKFILL=true)
 * y, en producción, --ack I_UNDERSTAND_THIS_IS_PRODUCTION. Sin todo eso → DRY-RUN (solo lee/valida).
 *
 * Cada documento se migra en su PROPIA transacción con compare-and-swap (idempotente, sin tocar
 * Storage). Lotes + checkpoints + reanudación. Exit: 0 OK · 1 guard/config · 2 error.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parseCliFlags, readEnvSelector } from '../lib/documents/cli-support'
import { resolveMigrationTarget, MigrationGuardError } from '../lib/documents/migration-env-guard'
import {
  backfillVersionTx,
  computePlanHash,
  canResumeCheckpoint,
  DocumentBackfillConflictError,
  type BackfillPlanItem,
  type BackfillCheckpoint,
} from '../lib/documents/backfill-core'
import { redactId, redactSecretsInText } from '../lib/documents/migration-redaction'

const CONFIRM_TOKEN = 'APPLY_DOCUMENT_BACKFILL'
const ARTIFACT_DIR = join('.artifacts', 'document-migration')

type PlanFile = { planHash: string; env: string; items: BackfillPlanItem[] }

function loadPlan(path: string): PlanFile {
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  if (!raw || typeof raw.planHash !== 'string' || !Array.isArray(raw.items)) {
    throw new Error('plan inválido: falta planHash o items')
  }
  return { planHash: raw.planHash, env: raw.env, items: raw.items }
}

async function main(): Promise<number> {
  const flags = parseCliFlags(process.argv.slice(2))
  const env = readEnvSelector(flags)

  if (typeof flags.plan !== 'string') {
    console.error('apply-document-backfill: falta --plan <file>.')
    return 1
  }
  const plan = loadPlan(flags.plan)
  const recomputed = computePlanHash(plan.items)

  // El plan debe ser íntegro y coincidir con --plan-hash.
  if (recomputed !== plan.planHash) {
    console.error(
      'apply-document-backfill: el plan ha sido alterado (hash recomputado != planHash).'
    )
    return 1
  }
  if (flags['plan-hash'] !== plan.planHash) {
    console.error('apply-document-backfill: --plan-hash no coincide con el plan. Aborta.')
    return 1
  }

  const isApply = flags.apply === true
  const batchSize =
    typeof flags['batch-size'] === 'string' ? Math.max(1, parseInt(flags['batch-size'], 10)) : 50
  const maxRecords =
    typeof flags['max-records'] === 'string' ? parseInt(flags['max-records'], 10) : Infinity
  const stopOnError = flags['stop-on-error'] === true
  // Por defecto continúa ante conflicto; `--no-continue-on-conflict` lo desactiva. (parseCliFlags
  // nunca produce el booleano `false`, así que la negación se lee de una flag propia.)
  const continueOnConflict = flags['no-continue-on-conflict'] !== true

  // ── DRY-RUN por defecto: no valida entorno destructivo, no conecta para escribir ──
  if (!isApply) {
    console.log('apply-document-backfill: DRY-RUN (no se escribe nada).')
    console.log(`  plan: ${plan.items.length} ítem(s), planHash=${plan.planHash}, env=${env}`)
    console.log(
      `  batchSize=${batchSize} maxRecords=${maxRecords} stopOnError=${stopOnError} continueOnConflict=${continueOnConflict}`
    )
    console.log(
      '  Para aplicar: --apply --plan <file> --plan-hash <hash> --env <env> --confirm APPLY_DOCUMENT_BACKFILL (+ allow-var / --ack).'
    )
    return 0
  }

  // ── APPLY: exige confirmación + guard de entorno para operación de escritura ──
  if (flags.confirm !== CONFIRM_TOKEN) {
    console.error(`apply-document-backfill: se requiere --confirm ${CONFIRM_TOKEN} para escribir.`)
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

  // Reanudación opcional desde checkpoint (solo si plan hash + entorno coinciden).
  mkdirSync(ARTIFACT_DIR, { recursive: true })
  const checkpointFile = join(ARTIFACT_DIR, `checkpoint-${env}-${plan.planHash.slice(0, 12)}.json`)
  let startIndex = 0
  const counters = { migrated: 0, skipped: 0, conflicts: 0, errors: 0 }
  if (flags.resume === true && existsSync(checkpointFile)) {
    const cp = JSON.parse(readFileSync(checkpointFile, 'utf8')) as BackfillCheckpoint
    if (canResumeCheckpoint(cp, { planHash: plan.planHash, env })) {
      startIndex = cp.lastIndex + 1
      counters.migrated = cp.migrated
      counters.skipped = cp.skipped
      counters.conflicts = cp.conflicts
      counters.errors = cp.errors
      console.log(`apply-document-backfill: reanudando desde el índice ${startIndex}.`)
    } else {
      console.error(
        'apply-document-backfill: el checkpoint no corresponde a este plan/entorno. Aborta.'
      )
      return 1
    }
  }

  const prisma = new PrismaClient({ datasourceUrl: url })
  const started = Date.now()
  let processed = 0
  // Índice del ÚLTIMO ítem realmente procesado (para no marcar completado un run truncado por
  // --max-records: si no, --resume saltaría todos los ítems restantes).
  let lastProcessedIndex = startIndex - 1
  try {
    for (let i = startIndex; i < plan.items.length; i++) {
      if (processed >= maxRecords) break
      const item = plan.items[i]
      try {
        const res = await prisma.$transaction((tx) => backfillVersionTx(tx, item))
        if (res.status === 'migrated') counters.migrated++
        else counters.skipped++
      } catch (err) {
        if (err instanceof DocumentBackfillConflictError) {
          counters.conflicts++
          console.warn(`  conflicto en ${item.rootType} ${redactId(item.rootId)}: ${err.reason}`)
          if (!continueOnConflict) {
            writeCheckpoint(checkpointFile, plan.planHash, env, i, counters)
            console.error(
              'apply-document-backfill: detenido por conflicto (--no-continue-on-conflict).'
            )
            return 2
          }
        } else {
          counters.errors++
          console.error(`  error en ${item.rootType} ${redactId(item.rootId)}`)
          if (stopOnError) {
            writeCheckpoint(checkpointFile, plan.planHash, env, i, counters)
            console.error('apply-document-backfill: detenido por error (--stop-on-error).')
            return 2
          }
        }
      }
      processed++
      lastProcessedIndex = i
      if (processed % batchSize === 0)
        writeCheckpoint(checkpointFile, plan.planHash, env, i, counters)
    }

    // Checkpoint terminal con el ÚLTIMO índice procesado (no length-1): así una parada por
    // --max-records deja el checkpoint en el punto real y --resume continúa desde ahí.
    writeCheckpoint(checkpointFile, plan.planHash, env, lastProcessedIndex, counters)
    console.log(
      `apply-document-backfill: FIN — migrados=${counters.migrated} omitidos=${counters.skipped} ` +
        `conflictos=${counters.conflicts} errores=${counters.errors} (${Date.now() - started} ms).`
    )
    return counters.errors > 0 ? 2 : 0
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`apply-document-backfill: error — ${redactSecretsInText(message)}`)
    return 2
  } finally {
    await prisma.$disconnect()
  }
}

function writeCheckpoint(
  file: string,
  planHash: string,
  env: string,
  lastIndex: number,
  c: { migrated: number; skipped: number; conflicts: number; errors: number }
): void {
  const cp: BackfillCheckpoint = {
    planHash,
    env,
    lastIndex,
    migrated: c.migrated,
    skipped: c.skipped,
    conflicts: c.conflicts,
    errors: c.errors,
    timestamp: new Date().toISOString(),
  }
  writeFileSync(file, JSON.stringify(cp, null, 2), { encoding: 'utf8', mode: 0o600 })
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`apply-document-backfill: error inesperado — ${redactSecretsInText(message)}`)
    process.exit(2)
  })
