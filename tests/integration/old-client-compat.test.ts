/**
 * PostgreSQL real: clientes generados desde aa739cc (regresión I3C1B) y 72dbc47
 * (main anterior a OPS-2), con el binario Prisma local. Ambos crean, leen, actualizan y borran
 * entregas legacy con comprador/oferta sobre la base reconstruida con todas las migraciones.
 * No demuestra rollback al cliente antiguo después de introducir destinatarios/ofertas nulos;
 * esas filas necesitan la versión puente. No representa el estado de ningún entorno remoto.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync, execSync } from 'node:child_process'
import { writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { requireTestDatabaseUrl } from './guard'

// Conserva la regresión histórica y añade el cliente de main anterior a OPS-2.
// Sólo datos legacy con comprador/oferta: no promete rollback viejo sobre filas manuales.
describe.each(['aa739cc', '72dbc47'])('cliente Prisma anterior %s', (DEPLOYED_COMMIT) => {
  let workDir: string
  let outDir: string
  let testUrl: string
  let generated = false
  let genError: string | null = null

  function runDeployedClient(mode: 'connect' | 'crud') {
    // El proceso hijo libera la DLL nativa antes de borrar el cliente generado (Windows).
    // La URL pasa sólo por el entorno del hijo y ya ha superado el guard anti-remoto.
    execFileSync(
      process.execPath,
      [
        join(process.cwd(), 'tests/integration/fixtures/deployed-client-crud.cjs'),
        join(outDir, 'index.js'),
        mode,
      ],
      { env: { ...process.env, TEST_DATABASE_URL: testUrl }, stdio: 'pipe', timeout: 30_000 }
    )
  }

  beforeAll(async () => {
    testUrl = requireTestDatabaseUrl(process.env, { requireReset: false })

    // Todo DENTRO del workspace, bajo node_modules (gitignored): Prisma resuelve su instalación y el
    // runtime `@prisma/client` relativos al schema. Un schema en /tmp haría que Prisma intente
    // instalarse (no encuentra node_modules junto al schema).
    workDir = join(process.cwd(), 'node_modules', `.deployed-client-ops2-${DEPLOYED_COMMIT}`)
    outDir = join(workDir, 'client')
    try {
      mkdirSync(workDir, { recursive: true })
      // 1) Schema inmutable de cada revisión; no alterar las relaciones del cliente anterior.
      let schema = execSync(`git show ${DEPLOYED_COMMIT}:prisma/schema.prisma`, {
        encoding: 'utf8',
      })
      // 2) Redirige el cliente generado a un subdirectorio aislado (no pisa el cliente de la rama).
      schema = schema.replace(
        /generator\s+client\s*\{[\s\S]*?\}/,
        `generator client {\n  provider = "prisma-client-js"\n  output   = "${outDir.replace(/\\/g, '/')}"\n}`
      )
      const schemaPath = join(workDir, 'deployed.prisma')
      writeFileSync(schemaPath, schema)
      // 3) Genera el cliente desplegado con el binario LOCAL de Prisma (misma versión 6.19.3). `pnpm
      //    exec` resuelve el binario del proyecto; NO usar `npx` (intentaría instalar Prisma).
      execSync(`pnpm exec prisma generate --schema "${schemaPath}"`, { stdio: 'pipe' })
      const entry = join(outDir, 'index.js')
      if (!existsSync(entry)) throw new Error(`no se generó el cliente desplegado en ${entry}`)
      // 4) Generación real y conexión en proceso aislado, nunca importar su DLL en Vitest.
      runDeployedClient('connect')
      generated = true
    } catch (e) {
      genError = e instanceof Error ? e.message : String(e)
    }
  }, 180_000)

  afterAll(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true })
  })

  describe('compatibilidad con el esquema expandido sobre datos legacy', () => {
    it('el cliente desplegado se generó y conectó', () => {
      if (!generated) throw new Error(`no se pudo preparar el cliente desplegado: ${genError}`)
      expect(generated).toBe(true)
    })

    it('crea/lee/actualiza/borra una Delivery con offer_id; sin P2022; sin fixtures residuales', async () => {
      if (!generated) throw new Error(`cliente desplegado no disponible: ${genError}`)
      runDeployedClient('crud')
    })
  })
})
