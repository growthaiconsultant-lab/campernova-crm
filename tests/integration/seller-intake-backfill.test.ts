import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createGuardedTestPrisma, uniqueSuffix } from './db'

const prisma = createGuardedTestPrisma()
const created = {
  userId: '',
  buyerId: '',
  sellerWithOfferId: '',
  vehicleWithOfferId: '',
  plainSellerId: '',
  plainVehicleId: '',
}

beforeAll(async () => {
  const suffix = uniqueSuffix()
  const user = await prisma.user.create({
    data: {
      email: `intake_backfill_${suffix}@integ.test`,
      name: `Intake ${suffix}`,
      role: 'AGENTE',
    },
  })
  created.userId = user.id

  const buyer = await prisma.buyerLead.create({
    data: {
      name: `Comprador ${suffix}`,
      email: `buyer_${suffix}@integ.test`,
      phone: '600111222',
    },
  })
  created.buyerId = buyer.id

  const withOffer = await prisma.sellerLead.create({
    data: {
      name: `Web con oferta ${suffix}`,
      canal: 'PRO',
      status: 'NUEVO',
      intakeStatus: 'PENDIENTE',
      vehicle: { create: { brand: 'Adria', model: 'Coral', status: 'NUEVO' } },
    },
    include: { vehicle: true },
  })
  created.sellerWithOfferId = withOffer.id
  created.vehicleWithOfferId = withOffer.vehicle!.id

  await prisma.offer.create({
    data: {
      vehicleId: created.vehicleWithOfferId,
      buyerLeadId: buyer.id,
      amount: 20_000,
      status: 'EXPIRADA',
      createdById: user.id,
    },
  })

  const plain = await prisma.sellerLead.create({
    data: {
      name: `Web sin operativa ${suffix}`,
      canal: 'PRO',
      status: 'NUEVO',
      intakeStatus: 'PENDIENTE',
      vehicle: { create: { brand: 'Adria', model: 'Twin', status: 'NUEVO' } },
    },
    include: { vehicle: true },
  })
  created.plainSellerId = plain.id
  created.plainVehicleId = plain.vehicle!.id
})

afterAll(async () => {
  if (created.vehicleWithOfferId) {
    await prisma.offer.deleteMany({ where: { vehicleId: created.vehicleWithOfferId } })
  }
  if (created.buyerId) await prisma.buyerLead.deleteMany({ where: { id: created.buyerId } })
  const vehicleIds = [created.vehicleWithOfferId, created.plainVehicleId].filter(Boolean)
  if (vehicleIds.length) await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } })
  const sellerIds = [created.sellerWithOfferId, created.plainSellerId].filter(Boolean)
  if (sellerIds.length) await prisma.sellerLead.deleteMany({ where: { id: { in: sellerIds } } })
  if (created.userId) await prisma.user.deleteMany({ where: { id: created.userId } })
  await prisma.$disconnect()
})

describe('integración · corrección del backfill de admisión', () => {
  it('conserva admitida una solicitud con oferta expirada sin admitir las pendientes limpias', async () => {
    const migration = await readFile(
      path.join(
        process.cwd(),
        'prisma/migrations/20260907184500_preserve_operational_web_intakes/migration.sql'
      ),
      'utf8'
    )

    await prisma.$executeRawUnsafe(migration)

    const [withOffer, plain] = await Promise.all([
      prisma.sellerLead.findUniqueOrThrow({ where: { id: created.sellerWithOfferId } }),
      prisma.sellerLead.findUniqueOrThrow({ where: { id: created.plainSellerId } }),
    ])
    expect(withOffer.intakeStatus).toBe('ADMITIDO')
    expect(withOffer.intakeReviewedAt).toBeNull()
    expect(withOffer.intakeReviewedById).toBeNull()
    expect(plain.intakeStatus).toBe('PENDIENTE')
  })
})
