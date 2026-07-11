/**
 * Tests de integración con PostgreSQL REAL (PR4) — conversión atómica de trade-ins.
 *
 * Demuestran que crear el lead de vendedor desde el vehículo de parte de pago de un
 * comprador (vendedor + vehículo + CAS-vínculo `BuyerLead.tradeInSellerLeadId` + trazas)
 * ocurre en una ÚNICA transacción. La exclusión se decide con compare-and-swap sobre el
 * campo de enlace único, no con la lectura previa. Dos procesamientos concurrentes del
 * mismo trade-in producen exactamente 1 éxito + 1 conflicto, sin vendedores huérfanos.
 *
 * Como la fuente (BuyerLead) no tiene estado intermedio, el vendedor se crea y luego se
 * hace el CAS-vínculo; el perdedor revierte su vendedor. La barrera usa `beforeLinkWrite`.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  convertTradeInTx,
  ConversionConflictError,
  type ConversionHooks,
  type ConvertTradeInParams,
} from '@/lib/capture-conversion'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prisma: PrismaClient

const TX_OPTS = { timeout: 20_000, maxWait: 15_000 }
const cleanups: Array<() => Promise<void>> = []

type Seeded = { buyerId: string; phone: string; suffix: string }

async function seed(): Promise<Seeded> {
  const s = uniqueSuffix()
  const phone = `ti_${s}`
  const buyer = await prisma.buyerLead.create({
    data: {
      name: `Ana ${s}`,
      email: `ana_${s}@integ.test`,
      phone,
      hasTradeIn: true,
      tradeInType: 'CAMPER',
      tradeInBrand: 'VW',
      tradeInModel: 'California',
      tradeInYear: 2019,
      tradeInKm: 80_000,
    },
  })

  cleanups.push(async () => {
    // Vendedor (cascada vehículo + traza origen; SetNull en buyer.tradeInSellerLeadId) → comprador.
    await prisma.sellerLead.deleteMany({ where: { phone } })
    await prisma.buyerLead.deleteMany({ where: { phone } })
  })

  return { buyerId: buyer.id, phone, suffix: s }
}

function tradeInParams(seeded: Seeded): ConvertTradeInParams {
  return {
    buyerLeadId: seeded.buyerId,
    sellerData: {
      name: `Ana ${seeded.suffix}`,
      email: `ana_${seeded.suffix}@integ.test`,
      phone: seeded.phone,
      canal: 'CN',
      status: 'NUEVO',
      vehicle: {
        create: {
          type: 'CAMPER',
          brand: `VW-${seeded.suffix}`,
          model: 'California',
          year: 2019,
          km: 80_000,
          seats: 4,
          conservationState: 'NORMAL',
          equipment: {},
          status: 'NUEVO',
        },
      },
      activities: { create: { type: 'NOTA', content: `Origen: parte de pago ${seeded.suffix}` } },
    },
    linkingNotePrefix:
      'Creado lead de vendedor desde el vehículo de parte de pago (Camper VW California).',
  }
}

function runConversion(seeded: Seeded, hooks?: ConversionHooks) {
  return prisma.$transaction((tx) => convertTradeInTx(tx, tradeInParams(seeded), hooks), TX_OPTS)
}

function twoPartyBarrier() {
  let arriveA!: () => void
  let arriveB!: () => void
  const aArrived = new Promise<void>((r) => (arriveA = r))
  const bArrived = new Promise<void>((r) => (arriveB = r))
  return {
    hookA: {
      beforeLinkWrite: async () => {
        arriveA()
        await bArrived
      },
    } satisfies ConversionHooks,
    hookB: {
      beforeLinkWrite: async () => {
        arriveB()
        await aArrived
      },
    } satisfies ConversionHooks,
  }
}

async function sellersFor(seeded: Seeded) {
  return prisma.sellerLead.findMany({ where: { phone: seeded.phone }, include: { vehicle: true } })
}

beforeAll(() => {
  prisma = createGuardedTestPrisma()
})
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean()
})
afterAll(async () => {
  await prisma?.$disconnect()
})

describe('integración · conversión de trade-in (camino feliz)', () => {
  it('crea vendedor + vehículo, vincula el comprador y deja 2 trazas', async () => {
    const seeded = await seed()
    const result = await runConversion(seeded)
    expect(result.sellerLeadId).toBeTruthy()

    const buyer = await prisma.buyerLead.findUnique({ where: { id: seeded.buyerId } })
    expect(buyer?.tradeInSellerLeadId).toBe(result.sellerLeadId)

    const sellers = await sellersFor(seeded)
    expect(sellers).toHaveLength(1)
    expect(sellers[0].canal).toBe('CN')
    expect(sellers[0].vehicle?.id).toBe(result.vehicleId)

    // Traza de origen (vendedor) + traza de enlace (comprador) = 2.
    const acts = await prisma.activity.count({
      where: { OR: [{ sellerLeadId: result.sellerLeadId }, { buyerLeadId: seeded.buyerId }] },
    })
    expect(acts).toBe(2)
  })
})

describe('integración · dos procesamientos concurrentes del mismo trade-in', () => {
  it('exactamente 1 éxito + 1 conflicto "tradein"; un único vendedor, sin huérfanos', async () => {
    const seeded = await seed()
    const { hookA, hookB } = twoPartyBarrier()

    const settled = await Promise.allSettled([
      runConversion(seeded, hookA),
      runConversion(seeded, hookB),
    ])
    const fulfilled = settled.filter((r) => r.status === 'fulfilled')
    const rejected = settled.filter((r) => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    const reason = (rejected[0] as PromiseRejectedResult).reason
    expect(reason).toBeInstanceOf(ConversionConflictError)
    expect((reason as ConversionConflictError).reason).toBe('tradein')

    const buyer = await prisma.buyerLead.findUnique({ where: { id: seeded.buyerId } })
    expect(buyer?.tradeInSellerLeadId).toBeTruthy()

    // El vendedor del perdedor se revierte → exactamente uno persiste, y es el vinculado.
    const sellers = await sellersFor(seeded)
    expect(sellers).toHaveLength(1)
    expect(sellers[0].id).toBe(buyer?.tradeInSellerLeadId)
    expect(sellers[0].vehicle).not.toBeNull()

    // Sin trazas duplicadas: origen + enlace = 2.
    const acts = await prisma.activity.count({
      where: { OR: [{ sellerLeadId: sellers[0].id }, { buyerLeadId: seeded.buyerId }] },
    })
    expect(acts).toBe(2)
  })
})

describe('integración · rollback y doble ejecución secuencial', () => {
  it('fallo antes del vínculo → vendedor revertido, comprador sin vincular, sin trazas', async () => {
    const seeded = await seed()
    await expect(
      runConversion(seeded, {
        beforeLinkWrite: async () => {
          throw new Error('fallo antes del vínculo')
        },
      })
    ).rejects.toThrow('fallo antes del vínculo')

    const buyer = await prisma.buyerLead.findUnique({ where: { id: seeded.buyerId } })
    expect(buyer?.tradeInSellerLeadId).toBeNull()
    expect(await prisma.sellerLead.count({ where: { phone: seeded.phone } })).toBe(0)
    const acts = await prisma.activity.count({ where: { buyerLeadId: seeded.buyerId } })
    expect(acts).toBe(0)
  })

  it('segunda conversión secuencial del mismo trade-in → conflicto, sin segundo vendedor', async () => {
    const seeded = await seed()
    const first = await runConversion(seeded)
    expect(first.sellerLeadId).toBeTruthy()

    const err = await runConversion(seeded).catch((e) => e)
    expect(err).toBeInstanceOf(ConversionConflictError)
    expect((err as ConversionConflictError).reason).toBe('tradein')

    // Sigue habiendo exactamente un vendedor (el de la primera conversión).
    const sellers = await sellersFor(seeded)
    expect(sellers).toHaveLength(1)
    expect(sellers[0].id).toBe(first.sellerLeadId)
  })
})
