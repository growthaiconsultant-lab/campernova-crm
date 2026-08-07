import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { withLockedRoots } from '@/lib/locking'
import { buildTechnicalValues } from '@/lib/vehicle-reception/model'
import {
  ReceptionError,
  reviewReceptionSectionTx,
  saveCommercialReceptionTx,
  saveTechnicalReceptionTx,
} from '@/lib/vehicle-reception/service'
import { createGuardedTestPrisma, uniqueSuffix } from './db'

let prismaA: PrismaClient
let prismaB: PrismaClient
const cleanups: Array<() => Promise<void>> = []

async function seedReceptionVehicle() {
  const suffix = uniqueSuffix()
  const user = await prismaA.user.create({
    data: {
      email: `reception_${suffix}@integ.test`,
      name: `Reception ${suffix}`,
      role: 'ADMIN',
    },
  })
  const seller = await prismaA.sellerLead.create({
    data: { name: 'Propietario', email: `seller_${suffix}@integ.test`, phone: '600000000' },
  })
  const vehicle = await prismaA.vehicle.create({
    data: {
      sellerLeadId: seller.id,
      brand: 'Adria',
      model: 'Coral',
      year: 2020,
      km: 25_000,
      seats: 4,
      type: 'AUTOCARAVANA',
      category: 'PERFILADA',
      purchasePrice: 45_000,
      keysCount: 2,
      status: 'NUEVO',
    },
  })
  cleanups.push(async () => {
    await prismaA.vehicle.deleteMany({ where: { id: vehicle.id } })
    await prismaA.sellerLead.deleteMany({ where: { id: seller.id } })
    await prismaA.user.deleteMany({ where: { id: user.id } })
  })
  return { user, seller, vehicle }
}

function commercialInput(expectedRevision = 0) {
  return {
    expectedRevision,
    name: 'Nombre actualizado',
    email: 'actualizado@integ.test',
    phone: '611111111',
    receptionDate: '2026-08-07',
    previousOwners: 1,
    maintenanceHistoryAvailable: true,
    saleReason: 'Cambio de vehículo',
    minPrice: 52_000,
  }
}

async function technicalInput(vehicleId: string, expectedRevision = 0) {
  const vehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })
  return {
    expectedRevision,
    ...buildTechnicalValues(vehicle, null),
    brand: 'Adria actualizada',
    vehicleKind: 'AUTOCARAVANA_PERFILADA' as const,
    hasSolarPanel: true,
    solarPowerW: 400,
    declaredKeysCount: 3,
    extrasNotes: 'Portamotos',
  }
}

beforeAll(() => {
  prismaA = createGuardedTestPrisma()
  prismaB = createGuardedTestPrisma()
})

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!()
})

afterAll(async () => {
  await Promise.all([prismaA.$disconnect(), prismaB.$disconnect()])
})

describe('cuestionario de recepción con PostgreSQL real', () => {
  it('compone fuentes canónicas sin tocar precio de compra ni custodia', async () => {
    const { user, seller, vehicle } = await seedReceptionVehicle()
    const technical = await technicalInput(vehicle.id)

    await withLockedRoots(
      [
        { type: 'vehicle', id: vehicle.id },
        { type: 'sellerLead', id: seller.id },
      ],
      (tx) => saveCommercialReceptionTx(tx, vehicle.id, commercialInput()),
      { client: prismaA }
    )
    await withLockedRoots(
      [{ type: 'vehicle', id: vehicle.id }],
      (tx) => saveTechnicalReceptionTx(tx, vehicle.id, technical),
      { client: prismaA }
    )
    await withLockedRoots(
      [{ type: 'vehicle', id: vehicle.id }],
      (tx) => reviewReceptionSectionTx(tx, user.id, vehicle.id, 'commercial', 1),
      { client: prismaA }
    )
    const completed = await withLockedRoots(
      [{ type: 'vehicle', id: vehicle.id }],
      (tx) => reviewReceptionSectionTx(tx, user.id, vehicle.id, 'technical', 1),
      { client: prismaA }
    )

    expect(completed.status).toBe('COMPLETADO')
    const savedVehicle = await prismaA.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })
    expect(savedVehicle.brand).toBe('Adria actualizada')
    expect(Number(savedVehicle.purchasePrice)).toBe(45_000)
    expect(savedVehicle.keysCount).toBe(2)
    const q = await prismaA.vehicleReceptionQuestionnaire.findUniqueOrThrow({
      where: { vehicleId: vehicle.id },
    })
    expect(q.declaredKeysCount).toBe(3)
    expect(q.completedAt).not.toBeNull()

    await prismaA.user.delete({ where: { id: user.id } })
    const afterReviewerDeletion = await prismaA.vehicleReceptionQuestionnaire.findUniqueOrThrow({
      where: { vehicleId: vehicle.id },
    })
    expect(afterReviewerDeletion.completedAt).not.toBeNull()
    expect(afterReviewerDeletion.commercialReviewedById).toBeNull()
    expect(afterReviewerDeletion.technicalReviewedById).toBeNull()
    expect(afterReviewerDeletion.completedById).toBeNull()
  })

  it('dos escrituras de la misma sección producen un ganador y un conflicto', async () => {
    const { vehicle } = await seedReceptionVehicle()
    const input = await technicalInput(vehicle.id)
    const results = await Promise.allSettled([
      withLockedRoots(
        [{ type: 'vehicle', id: vehicle.id }],
        (tx) => saveTechnicalReceptionTx(tx, vehicle.id, input),
        { client: prismaA, lockTimeoutMs: 10_000 }
      ),
      withLockedRoots(
        [{ type: 'vehicle', id: vehicle.id }],
        (tx) => saveTechnicalReceptionTx(tx, vehicle.id, input),
        { client: prismaB, lockTimeoutMs: 10_000 }
      ),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toBeInstanceOf(ReceptionError)
    expect((rejected.reason as ReceptionError).code).toBe('CONFLICT')
    expect(
      await prismaA.vehicleReceptionQuestionnaire.count({ where: { vehicleId: vehicle.id } })
    ).toBe(1)
  })

  it('dos secciones concurrentes conservan ambos patches', async () => {
    const { seller, vehicle } = await seedReceptionVehicle()
    const technical = await technicalInput(vehicle.id)

    await Promise.all([
      withLockedRoots(
        [
          { type: 'vehicle', id: vehicle.id },
          { type: 'sellerLead', id: seller.id },
        ],
        (tx) => saveCommercialReceptionTx(tx, vehicle.id, commercialInput()),
        { client: prismaA, lockTimeoutMs: 10_000 }
      ),
      withLockedRoots(
        [{ type: 'vehicle', id: vehicle.id }],
        (tx) => saveTechnicalReceptionTx(tx, vehicle.id, technical),
        { client: prismaB, lockTimeoutMs: 10_000 }
      ),
    ])

    const q = await prismaA.vehicleReceptionQuestionnaire.findUniqueOrThrow({
      where: { vehicleId: vehicle.id },
    })
    expect(q.commercialRevision).toBe(1)
    expect(q.technicalRevision).toBe(1)
    expect(q.saleReason).toBe('Cambio de vehículo')
    expect(q.extrasNotes).toBe('Portamotos')
  })

  it('editar después de completar invalida sólo la revisión técnica', async () => {
    const { user, seller, vehicle } = await seedReceptionVehicle()
    const technical = await technicalInput(vehicle.id)
    await withLockedRoots(
      [
        { type: 'vehicle', id: vehicle.id },
        { type: 'sellerLead', id: seller.id },
      ],
      (tx) => saveCommercialReceptionTx(tx, vehicle.id, commercialInput()),
      { client: prismaA }
    )
    await withLockedRoots(
      [{ type: 'vehicle', id: vehicle.id }],
      (tx) => saveTechnicalReceptionTx(tx, vehicle.id, technical),
      { client: prismaA }
    )
    await withLockedRoots(
      [{ type: 'vehicle', id: vehicle.id }],
      (tx) => reviewReceptionSectionTx(tx, user.id, vehicle.id, 'commercial', 1),
      { client: prismaA }
    )
    await withLockedRoots(
      [{ type: 'vehicle', id: vehicle.id }],
      (tx) => reviewReceptionSectionTx(tx, user.id, vehicle.id, 'technical', 1),
      { client: prismaA }
    )

    await withLockedRoots(
      [{ type: 'vehicle', id: vehicle.id }],
      (tx) => saveTechnicalReceptionTx(tx, vehicle.id, { ...technical, expectedRevision: 1 }),
      { client: prismaA }
    )
    const q = await prismaA.vehicleReceptionQuestionnaire.findUniqueOrThrow({
      where: { vehicleId: vehicle.id },
    })
    expect(q.commercialReviewedRevision).toBe(1)
    expect(q.technicalReviewedRevision).toBeNull()
    expect(q.completedAt).toBeNull()
  })
})
