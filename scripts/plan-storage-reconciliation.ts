/**
 * PR5B3 — Plan de reconciliación de buckets (READ-ONLY, no aplica cambios).
 *
 * Lee la configuración real de los buckets (vía el cliente admin) y la compara con la esperada
 * (PR5B2), produciendo acciones (CREATE_BUCKET / UPDATE_BUCKET_CONFIG / DEPRECATE_BUCKET /
 * MANUAL_REVIEW). NUNCA aplica cambios, NUNCA elimina `lead-documents`. La aplicación real es
 * manual y queda fuera de PR5B3.
 *
 * Uso: pnpm documents:plan-storage-reconciliation -- --env local
 */
import { parseCliFlags, readEnvSelector } from '../lib/documents/cli-support'
import { resolveStorageTarget, MigrationGuardError } from '../lib/documents/migration-env-guard'
import { getSupabaseAdminClient } from '../lib/supabase/admin'
import { planBucketReconciliation, type ActualBucket } from '../lib/documents/reconciliation-core'
import { redactSecretsInText } from '../lib/documents/migration-redaction'

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

  try {
    const admin = getSupabaseAdminClient()
    const { data: buckets, error } = await admin.storage.listBuckets()
    if (error || !buckets) {
      console.error('plan-storage-reconciliation: no se pudieron listar los buckets.')
      return 2
    }
    const actual: ActualBucket[] = buckets.map((b) => ({
      id: b.id,
      public: b.public,
      fileSizeLimit: (b as { file_size_limit?: number | null }).file_size_limit ?? null,
      allowedMimeTypes: (b as { allowed_mime_types?: string[] | null }).allowed_mime_types ?? null,
    }))

    const plan = planBucketReconciliation(actual)
    const report = {
      tool: 'plan-storage-reconciliation',
      readOnly: true,
      appliesChanges: false,
      timestamp: new Date().toISOString(),
      env,
      actions: plan,
    }
    console.log(JSON.stringify(report, null, 2))
    console.log(
      `plan-storage-reconciliation: OK — ${plan.length} acción(es) propuesta(s) (NO aplicadas).`
    )
    return 0
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`plan-storage-reconciliation: error — ${redactSecretsInText(message)}`)
    return 2
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`plan-storage-reconciliation: error inesperado — ${redactSecretsInText(message)}`)
    process.exit(2)
  })
