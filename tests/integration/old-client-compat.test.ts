/**
 * Tests de integración con PostgreSQL REAL (PR I3C1B) — el Prisma Client ACTUALMENTE DESPLEGADO
 * funciona contra el schema contract.
 *
 * `THE PRISMA CLIENT GENERATED FROM aa739cc WORKS AGAINST THE I3C1B CONTRACT SCHEMA`
 *
 * El código desplegado (I3C1A, squash `aa739cc`) conoce `offer_id` y **siempre lo persiste**: su
 * schema tiene `Delivery.offerId String?` (nullable durante expand). Aquí se genera el Prisma Client
 * genuino a partir del `schema.prisma` de `aa739cc` y se ejecuta contra la base con las 6 migraciones
 * (incluida la contract `SET NOT NULL`), demostrando que crea/lee/actualiza/borra una Delivery **con**
 * `offerId` sin P2022 ni errores de relación/deserialización.
 *
 * El cliente pre-I3C1A (que NO conoce `offer_id`) no puede crear Deliveries tras el contract: esa
 * incompatibilidad histórica es esperada, no un fallo de I3C1B (ver la prueba negativa en
 * `delivery-creation.test.ts`).
 *
 * `prisma`/`@prisma/client` son idénticos (6.19.3) en `aa739cc` y en esta rama, por lo que el cliente
 * generado desde el schema de `aa739cc` con el binario local es el mismo que corre en producción; no
 * hace falta reinstalar dependencias ni un worktree completo.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { requireTestDatabaseUrl } from './guard'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

const DEPLOYED_COMMIT = 'aa739cc'

/* eslint-disable @typescript-eslint/no-explicit-any */
let workDir: string
let outDir: string
let deployedClient: any
let newClient: ReturnType<typeof createGuardedTestPrisma>
let generated = false
let genError: string | null = null

beforeAll(async () => {
  const testUrl = requireTestDatabaseUrl(process.env, { requireReset: false })
  newClient = createGuardedTestPrisma({ requireReset: false })

  // Todo DENTRO del workspace, bajo node_modules (gitignored): Prisma resuelve su instalación y el
  // runtime `@prisma/client` relativos al schema. Un schema en /tmp haría que Prisma intente
  // instalarse (no encuentra node_modules junto al schema).
  workDir = join(process.cwd(), 'node_modules', '.deployed-client-i3c1b')
  outDir = join(workDir, 'client')
  try {
    mkdirSync(workDir, { recursive: true })
    // 1) Schema de aa739cc (Delivery.offerId nullable, pero conocido y persistido por el código).
    let schema = execSync(`git show ${DEPLOYED_COMMIT}:prisma/schema.prisma`, { encoding: 'utf8' })
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
    // 4) Carga el cliente (CJS generado por Prisma) y conéctalo SOLO a la base de test.
    const mod: any = await import(pathToFileURL(entry).href)
    const DeployedPrismaClient = mod.PrismaClient ?? mod.default?.PrismaClient
    if (typeof DeployedPrismaClient !== 'function') {
      throw new Error('el cliente desplegado no expone PrismaClient')
    }
    deployedClient = new DeployedPrismaClient({ datasourceUrl: testUrl })
    await deployedClient.$connect()
    generated = true
  } catch (e) {
    genError = e instanceof Error ? e.message : String(e)
  }
}, 180_000)

afterAll(async () => {
  if (deployedClient) await deployedClient.$disconnect().catch(() => {})
  if (newClient) await newClient.$disconnect().catch(() => {})
  if (workDir) rmSync(workDir, { recursive: true, force: true })
})

describe('compatibilidad del Prisma Client de aa739cc con el schema contract', () => {
  it('el cliente desplegado se generó y conectó', () => {
    if (!generated) throw new Error(`no se pudo preparar el cliente desplegado: ${genError}`)
    expect(generated).toBe(true)
  })

  it('crea/lee/actualiza/borra una Delivery con offer_id; sin P2022; sin fixtures residuales', async () => {
    if (!generated) throw new Error(`cliente desplegado no disponible: ${genError}`)
    const s = uniqueSuffix()
    // Fixtures con el cliente desplegado (contrato de aa739cc: Delivery conoce offerId).
    const seller = await deployedClient.sellerLead.create({
      data: { name: `S ${s}`, email: `s_${s}@deployed.test`, phone: '600000000' },
    })
    const vehicle = await deployedClient.vehicle.create({
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
    const buyer = await deployedClient.buyerLead.create({
      data: { name: `B ${s}`, email: `b_${s}@deployed.test`, phone: '600000001' },
    })
    const user = await deployedClient.user.create({
      data: { name: `U ${s}`, email: `u_${s}@deployed.test`, role: 'AGENTE' },
    })
    const offer = await deployedClient.offer.create({
      data: {
        vehicleId: vehicle.id,
        buyerLeadId: buyer.id,
        amount: 25000,
        createdById: user.id,
        status: 'CONVERTIDA',
      },
    })

    let deliveryId = ''
    try {
      // CREATE con offerId — el cliente desplegado conoce la columna y siempre la persiste.
      const created = await deployedClient.delivery.create({
        data: {
          vehicleId: vehicle.id,
          buyerLeadId: buyer.id,
          offerId: offer.id,
          scheduledAt: new Date(),
          status: 'PROGRAMADA',
        },
      })
      deliveryId = created.id
      expect(created.offerId).toBe(offer.id)

      // READ con el cliente desplegado.
      const read = await deployedClient.delivery.findUnique({ where: { id: deliveryId } })
      expect(read).not.toBeNull()
      expect(read.status).toBe('PROGRAMADA')
      expect(read.offerId).toBe(offer.id)

      // UPDATE de un campo conocido.
      const updated = await deployedClient.delivery.update({
        where: { id: deliveryId },
        data: { notes: 'nota desplegada' },
      })
      expect(updated.notes).toBe('nota desplegada')

      // Verificación independiente por SQL: offer_id quedó persistido (no NULL).
      const rows = await newClient.$queryRaw<
        Array<{ offer_id: string | null }>
      >`SELECT "offer_id" FROM "deliveries" WHERE "id" = ${deliveryId}`
      expect(rows).toHaveLength(1)
      expect(rows[0].offer_id).toBe(offer.id)
    } finally {
      // Cleanup con el cliente desplegado — cero fixtures residuales.
      if (deliveryId)
        await deployedClient.delivery.delete({ where: { id: deliveryId } }).catch(() => {})
      await deployedClient.offer.delete({ where: { id: offer.id } }).catch(() => {})
      await deployedClient.vehicle.delete({ where: { id: vehicle.id } }).catch(() => {})
      await deployedClient.sellerLead.delete({ where: { id: seller.id } }).catch(() => {})
      await deployedClient.buyerLead.delete({ where: { id: buyer.id } }).catch(() => {})
      await deployedClient.user.delete({ where: { id: user.id } }).catch(() => {})
    }
  })
})
