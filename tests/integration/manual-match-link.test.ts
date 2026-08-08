/** REL-1 · integración PostgreSQL real: unique, locks e idempotencia del vínculo manual. */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createGuardedTestPrisma, uniqueSuffix } from './db'
import { withLockedRoots } from '@/lib/locking'
import { createOrPinManualMatch } from '@/lib/matching/manual-link'

let prismaA: PrismaClient
let prismaB: PrismaClient
let actorId: string
const cleanups: Array<() => Promise<void>> = []

beforeAll(async () => {
  prismaA = createGuardedTestPrisma()
  prismaB = createGuardedTestPrisma()
  const suffix = uniqueSuffix()
  const actor = await prismaA.user.create({
    data: { email: `rel1_${suffix}@integ.test`, name: `REL-1 ${suffix}`, role: 'AGENTE' },
  })
  actorId = actor.id
})

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!()
})

afterAll(async () => {
  await prismaA.user.deleteMany({ where: { id: actorId } })
  await Promise.all([prismaA.$disconnect(), prismaB.$disconnect()])
})

async function seedPair() {
  const suffix = uniqueSuffix()
  const seller = await prismaA.sellerLead.create({
    data: { name: `Seller ${suffix}`, email: `s_${suffix}@integ.test`, phone: '600000000' },
  })
  const vehicle = await prismaA.vehicle.create({
    data: {
      sellerLeadId: seller.id,
      brand: 'Adria',
      model: 'Coral',
      year: 2020,
      km: 10_000,
      seats: 4,
      type: 'AUTOCARAVANA',
      status: 'VENDIDO',
    },
  })
  const buyer = await prismaA.buyerLead.create({
    data: { name: `Buyer ${suffix}`, email: `b_${suffix}@integ.test`, phone: '600000001' },
  })

  cleanups.push(async () => {
    await prismaA.activity.deleteMany({
      where: { OR: [{ sellerLeadId: seller.id }, { buyerLeadId: buyer.id }] },
    })
    await prismaA.match.deleteMany({ where: { vehicleId: vehicle.id, buyerLeadId: buyer.id } })
    await prismaA.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prismaA.buyerLead.deleteMany({ where: { id: buyer.id } })
    await prismaA.sellerLead.deleteMany({ where: { id: seller.id } })
  })

  return { sellerId: seller.id, vehicleId: vehicle.id, buyerId: buyer.id }
}

function link(
  client: PrismaClient,
  pair: { sellerId: string; vehicleId: string; buyerId: string }
) {
  return withLockedRoots(
    [
      { type: 'vehicle', id: pair.vehicleId },
      { type: 'sellerLead', id: pair.sellerId },
      { type: 'buyerLead', id: pair.buyerId },
    ],
    (tx) =>
      createOrPinManualMatch(tx, {
        vehicleId: pair.vehicleId,
        buyerLeadId: pair.buyerId,
        resolvedSellerLeadId: pair.sellerId,
        actorId,
        reason: 'OTRO',
        notes: null,
        now: new Date('2026-08-08T10:00:00Z'),
      }),
    { client, lockTimeoutMs: 8_000 }
  )
}

describe('REL-1 · vínculo manual concurrente', () => {
  it('dos writers convergen en una fila y exactamente dos Activities', async () => {
    const pair = await seedPair()

    const results = await Promise.all([link(prismaA, pair), link(prismaB, pair)])

    expect(results.map((result) => result.status).sort()).toEqual(['already_linked', 'created'])
    expect(
      await prismaA.match.count({
        where: { vehicleId: pair.vehicleId, buyerLeadId: pair.buyerId },
      })
    ).toBe(1)
    expect(
      await prismaA.activity.count({
        where: {
          type: 'MATCH_CREADO',
          OR: [{ sellerLeadId: pair.sellerId }, { buyerLeadId: pair.buyerId }],
        },
      })
    ).toBe(2)
  })

  it('el constraint rechaza scores fuera de 0–100', async () => {
    const pair = await seedPair()

    await expect(
      prismaA.match.create({
        data: {
          vehicleId: pair.vehicleId,
          buyerLeadId: pair.buyerId,
          score: 101,
          generatedBy: 'auto',
        },
      })
    ).rejects.toThrow()
    expect(
      await prismaA.match.count({
        where: { vehicleId: pair.vehicleId, buyerLeadId: pair.buyerId },
      })
    ).toBe(0)
  })
})
