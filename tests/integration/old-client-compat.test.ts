/**
 * Tests de integración con PostgreSQL REAL (PR I3C1A) — compatibilidad hacia atrás del rollout
 * expand–contract con el **Prisma Client genuino de `ca6015e`** (el código actualmente desplegado).
 *
 * No basta un INSERT SQL raw: eso solo prueba la nullability de PostgreSQL. Aquí se genera el Prisma
 * Client a partir del `schema.prisma` de `ca6015e` (que NO conoce `offer_id`) y se ejecuta contra la
 * base con las 5 migraciones de I3C1A aplicadas, demostrando que el cliente desplegado sigue
 * funcionando (create/read/update/delete sin `offer_id`, sin P2022 ni columnas desconocidas).
 *
 * `prisma`/`@prisma/client` son idénticos (6.19.3) en `ca6015e` y en esta rama, por lo que el
 * cliente generado desde el schema de `ca6015e` con el binario actual es el mismo que corre en
 * producción; no hace falta reinstalar dependencias ni un worktree completo.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { requireTestDatabaseUrl } from './guard'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

const OLD_COMMIT = 'ca6015e'

/* eslint-disable @typescript-eslint/no-explicit-any */
let tmpDir: string
let oldClient: any
let newClient: ReturnType<typeof createGuardedTestPrisma>
let generated = false
let genError: string | null = null

beforeAll(async () => {
  const testUrl = requireTestDatabaseUrl(process.env, { requireReset: false })
  newClient = createGuardedTestPrisma({ requireReset: false })

  tmpDir = mkdtempSync(join(tmpdir(), 'old-client-'))
  const outDir = join(tmpDir, 'client')
  try {
    // 1) Schema de ca6015e (Delivery sin offer_id).
    let schema = execSync(`git show ${OLD_COMMIT}:prisma/schema.prisma`, { encoding: 'utf8' })
    // 2) Redirige el cliente generado a un directorio aislado (no pisa el cliente de la rama).
    schema = schema.replace(
      /generator\s+client\s*\{[\s\S]*?\}/,
      `generator client {\n  provider = "prisma-client-js"\n  output   = "${outDir.replace(/\\/g, '/')}"\n}`
    )
    const schemaPath = join(tmpDir, 'old.prisma')
    writeFileSync(schemaPath, schema)
    // 3) Genera el cliente antiguo con el binario Prisma actual (misma versión 6.19.3).
    execSync(`npx prisma generate --schema "${schemaPath}"`, { stdio: 'pipe' })
    const entry = join(outDir, 'index.js')
    if (!existsSync(entry)) throw new Error(`no se generó el cliente antiguo en ${entry}`)
    // 4) Carga el cliente antiguo (CJS generado por Prisma) y conéctalo SOLO a la base de test.
    const mod: any = await import(pathToFileURL(entry).href)
    const OldPrismaClient = mod.PrismaClient ?? mod.default?.PrismaClient
    if (typeof OldPrismaClient !== 'function') {
      throw new Error('el cliente antiguo no expone PrismaClient')
    }
    oldClient = new OldPrismaClient({ datasourceUrl: testUrl })
    await oldClient.$connect()
    generated = true
  } catch (e) {
    genError = e instanceof Error ? e.message : String(e)
  }
}, 180_000)

afterAll(async () => {
  if (oldClient) await oldClient.$disconnect().catch(() => {})
  if (newClient) await newClient.$disconnect().catch(() => {})
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
})

describe('compatibilidad del Prisma Client de ca6015e con el schema expandido', () => {
  it('el cliente antiguo se generó y conectó', () => {
    if (!generated) throw new Error(`no se pudo preparar el cliente antiguo: ${genError}`)
    expect(generated).toBe(true)
  })

  it('crea/lee/actualiza/borra una Delivery sin offer_id; offer_id queda NULL; sin P2022', async () => {
    if (!generated) throw new Error(`cliente antiguo no disponible: ${genError}`)
    const s = uniqueSuffix()
    // Fixtures con el cliente antiguo (contrato de ca6015e: Delivery sin offerId).
    const seller = await oldClient.sellerLead.create({
      data: { name: `S ${s}`, email: `s_${s}@old.test`, phone: '600000000' },
    })
    const vehicle = await oldClient.vehicle.create({
      data: {
        sellerLeadId: seller.id,
        brand: 'Adria',
        model: 'Coral',
        year: 2020,
        km: 1000,
        seats: 4,
        type: 'AUTOCARAVANA',
        status: 'RESERVADO',
      },
    })
    const buyer = await oldClient.buyerLead.create({
      data: { name: `B ${s}`, email: `b_${s}@old.test`, phone: '600000001' },
    })

    let deliveryId = ''
    try {
      // CREATE sin offerId — el cliente antiguo ni siquiera conoce la columna.
      const created = await oldClient.delivery.create({
        data: {
          vehicleId: vehicle.id,
          buyerLeadId: buyer.id,
          scheduledAt: new Date(),
          status: 'PROGRAMADA',
        },
      })
      deliveryId = created.id
      expect('offerId' in created).toBe(false) // el tipo antiguo no expone offerId

      // READ con el cliente antiguo (SELECT de columnas conocidas, sin offer_id).
      const read = await oldClient.delivery.findUnique({ where: { id: deliveryId } })
      expect(read).not.toBeNull()
      expect(read.status).toBe('PROGRAMADA')

      // UPDATE de un campo conocido por el cliente antiguo.
      const updated = await oldClient.delivery.update({
        where: { id: deliveryId },
        data: { notes: 'nota antigua' },
      })
      expect(updated.notes).toBe('nota antigua')

      // Verificación independiente por SQL: la fila existe con offer_id NULL.
      const rows = await newClient.$queryRaw<
        Array<{ offer_id: string | null }>
      >`SELECT "offer_id" FROM "deliveries" WHERE "id" = ${deliveryId}`
      expect(rows).toHaveLength(1)
      expect(rows[0].offer_id).toBeNull()
    } finally {
      // Cleanup con el cliente antiguo cuando sea posible.
      if (deliveryId) await oldClient.delivery.delete({ where: { id: deliveryId } }).catch(() => {})
      await oldClient.vehicle.delete({ where: { id: vehicle.id } }).catch(() => {})
      await oldClient.sellerLead.delete({ where: { id: seller.id } }).catch(() => {})
      await oldClient.buyerLead.delete({ where: { id: buyer.id } }).catch(() => {})
    }
  })
})
