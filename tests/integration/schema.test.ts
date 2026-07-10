/**
 * Tests de integración con PostgreSQL REAL (PR0). Requieren una base de datos de test
 * efímera (`TEST_DATABASE_URL`) ya migrada con `pnpm test:integration:prepare`.
 *
 * Cubren: conectividad Prisma sin mocks · estado de migraciones · acceso a una tabla
 * real · aislamiento (escritura + limpieza + repetibilidad).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createGuardedTestPrisma, uniqueSuffix, countAppliedMigrations, tableExists } from './db'

let prisma: PrismaClient

beforeAll(() => {
  prisma = createGuardedTestPrisma()
})

afterAll(async () => {
  await prisma?.$disconnect()
})

describe('integración · conectividad Prisma (sin mocks)', () => {
  it('8.1 · Prisma conecta y ejecuta una consulta real sobre una tabla del proyecto', async () => {
    // Consulta real contra una tabla real: no debe lanzar y devuelve un número.
    const users = await prisma.user.count()
    expect(typeof users).toBe('number')
    expect(users).toBeGreaterThanOrEqual(0)
  })

  it('8.1 · un SELECT crudo confirma que la conexión es a un Postgres real', async () => {
    const rows = await prisma.$queryRaw<Array<{ one: number }>>`SELECT 1 AS one`
    expect(rows[0]?.one).toBe(1)
  })
})

describe('integración · estado de migraciones', () => {
  it('8.2 · _prisma_migrations contiene las migraciones aplicadas', async () => {
    const applied = await countAppliedMigrations(prisma)
    // El proyecto tiene 26 migraciones versionadas (incluida la RLS de PR1).
    expect(applied).toBeGreaterThanOrEqual(26)
  })

  it('8.2 · existen tablas núcleo esperadas del esquema migrado', async () => {
    for (const table of ['users', 'vehicles', 'offers', 'calendar_events', 'kpi_events']) {
      expect(await tableExists(prisma, table)).toBe(true)
    }
  })
})

describe('integración · aislamiento y limpieza', () => {
  it('8.5 · escribe y elimina un registro real, sin dejar residuos y repetible', async () => {
    const marker = `__integ_test_${uniqueSuffix()}`

    // Estado inicial limpio (sin residuos de ejecuciones previas).
    const before = await prisma.referencePrice.count({ where: { brand: marker } })
    expect(before).toBe(0)

    // Escritura real (ReferencePrice: entidad standalone, sin FKs de negocio).
    const created = await prisma.referencePrice.create({
      data: {
        brand: marker,
        model: 'INTEGRATION',
        type: 'CAMPER',
        baseYear: 2020,
        basePrice: 1000,
        depreciationPerKm: 0.01,
      },
    })
    expect(created.id).toBeTruthy()

    const present = await prisma.referencePrice.count({ where: { brand: marker } })
    expect(present).toBe(1)

    // Limpieza.
    await prisma.referencePrice.deleteMany({ where: { brand: marker } })

    const after = await prisma.referencePrice.count({ where: { brand: marker } })
    expect(after).toBe(0)
  })
})
