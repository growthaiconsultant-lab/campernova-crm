/**
 * Prepara la base de datos de integración (PR0).
 *
 * 1) Valida con el guard que `TEST_DATABASE_URL` es una base de datos de test efímera
 *    (nunca staging/producción) y que `NODE_ENV=test` + `ALLOW_INTEGRATION_DB_RESET=true`.
 * 2) Aplica TODAS las migraciones reales del proyecto con `prisma migrate deploy`
 *    (nunca `db push`, nunca esquema alternativo), apuntando `DATABASE_URL`/`DIRECT_URL`
 *    a la base de test.
 *
 * No aplica ningún bootstrap de Supabase: las migraciones del proyecto son PostgreSQL
 * estándar (no referencian roles anon/authenticated/service_role, ni esquemas auth/
 * storage, ni extensiones). Si en el futuro una migración lo requiriese, el bootstrap
 * iría en un script separado e idempotente, jamás en staging/producción.
 *
 * No imprime la URL ni credenciales.
 */
import { execSync } from 'node:child_process'
import { requireTestDatabaseUrl } from '../tests/integration/guard'

function main(): void {
  // Guard: exige base de test efímera + NODE_ENV=test + ALLOW_INTEGRATION_DB_RESET=true.
  const testUrl = requireTestDatabaseUrl(process.env, { requireReset: true })

  console.log('[integration-prepare] guard OK — base de datos de test verificada')
  console.log('[integration-prepare] aplicando migraciones con `prisma migrate deploy`…')

  execSync('pnpm prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Prisma migrate usa DIRECT_URL (directUrl) y DATABASE_URL: ambos → base de test.
      DATABASE_URL: testUrl,
      DIRECT_URL: testUrl,
    },
  })

  console.log('[integration-prepare] migraciones aplicadas correctamente')
}

try {
  main()
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[integration-prepare] error: ${message}`)
  process.exit(1)
}
