import { previewDatabasePreflight } from '../lib/deploy/preview-database-preflight'

// No Prisma, network, file writes, env dump, or credential export. Runs before the build.
const result = previewDatabasePreflight(process.env)
if (result === 'PASS') {
  console.log('preview-db-preflight: PASS — staging correcto (DATABASE_URL y DIRECT_URL)')
} else if (result === 'BLOCKED') {
  console.error('preview-db-preflight: BLOCKED — identidad de staging no verificada')
  process.exitCode = 1
}
