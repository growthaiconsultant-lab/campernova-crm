import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createGuardedTestPrisma, uniqueSuffix } from './db'
import { persistVehiclePhotoOrder } from '@/lib/vehicle-photo-order'
import { Prisma, type PrismaClient } from '@prisma/client'

const db = createGuardedTestPrisma()
const marker = `photo-order-${uniqueSuffix()}`
const sellerIds = [`${marker}-seller-a`, `${marker}-seller-b`]
const vehicleIds = [`${marker}-vehicle-a`, `${marker}-vehicle-b`]
const photoIds = Array.from({ length: 3 }, (_, i) => `${marker}-photo-${i}`)
const foreignId = `${marker}-foreign`

beforeAll(async () => {
  await db.sellerLead.createMany({
    data: sellerIds.map((id) => ({ id, name: marker, canal: 'CN' })),
  })
  await db.vehicle.createMany({
    data: vehicleIds.map((id, i) => ({ id, sellerLeadId: sellerIds[i] })),
  })
  await db.vehiclePhoto.createMany({
    data: [
      ...photoIds.map((id, order) => ({
        id,
        vehicleId: vehicleIds[0],
        order,
        url: 'https://example.invalid/qa-photo',
      })),
      {
        id: foreignId,
        vehicleId: vehicleIds[1],
        order: 7,
        url: 'https://example.invalid/qa-photo',
      },
    ],
  })
})

beforeEach(async () => {
  await db.$transaction(
    photoIds.map((id, order) => db.vehiclePhoto.update({ where: { id }, data: { order } }))
  )
})

afterAll(async () => {
  await db.vehiclePhoto.deleteMany({ where: { id: { in: [...photoIds, foreignId] } } })
  await db.vehicle.deleteMany({ where: { id: { in: vehicleIds } } })
  await db.sellerLead.deleteMany({ where: { id: { in: sellerIds } } })
  await db.$disconnect()
})

async function currentOrder() {
  return db.vehiclePhoto.findMany({
    where: { vehicleId: vehicleIds[0] },
    orderBy: { order: 'asc' },
    select: { id: true, order: true },
  })
}

describe('bulk photo ordering against PostgreSQL', () => {
  it('persists a complete permutation, is idempotent and leaves another vehicle unchanged', async () => {
    const reversed = [...photoIds].reverse()
    for (let i = 0; i < 2; i++) {
      expect(await persistVehiclePhotoOrder(db, vehicleIds[0], reversed)).toEqual({
        sellerLeadId: sellerIds[0],
      })
      expect(await currentOrder()).toEqual(reversed.map((id, order) => ({ id, order })))
    }
    expect(
      await db.vehiclePhoto.findUnique({ where: { id: foreignId }, select: { order: true } })
    ).toEqual({ order: 7 })
  })

  it('rejects duplicates, missing IDs and cross-vehicle IDs without partial writes', async () => {
    for (const ids of [
      [photoIds[0], photoIds[0], photoIds[2]],
      photoIds.slice(1),
      [photoIds[0], photoIds[1], foreignId],
    ]) {
      expect(await persistVehiclePhotoOrder(db, vehicleIds[0], ids)).toHaveProperty('error')
      expect(await currentOrder()).toEqual(photoIds.map((id, order) => ({ id, order })))
    }
  })

  it('concurrent reorders commit a whole permutation or report a recoverable conflict, never a mix', async () => {
    const orders = [
      [photoIds[2], photoIds[0], photoIds[1]],
      [photoIds[1], photoIds[2], photoIds[0]],
    ]
    // Barrier forces both real transactions to validate the same snapshot before writing.
    let arrivals = 0
    let release!: () => void
    const bothRead = new Promise<void>((resolve) => {
      release = resolve
    })
    const racingDatabase = {
      $transaction: (
        run: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options: { isolationLevel: Prisma.TransactionIsolationLevel }
      ) =>
        db.$transaction(
          async (tx) =>
            run({
              ...tx,
              vehiclePhoto: {
                ...tx.vehiclePhoto,
                findMany: async (args: Prisma.VehiclePhotoFindManyArgs) => {
                  const rows = await tx.vehiclePhoto.findMany(args)
                  if (++arrivals === 2) release()
                  await bothRead
                  return rows
                },
              },
            } as Prisma.TransactionClient),
          options
        ),
    } as unknown as Pick<PrismaClient, '$transaction'>
    const results = await Promise.all(
      orders.map((ids) => persistVehiclePhotoOrder(racingDatabase, vehicleIds[0], ids))
    )
    const committed = orders.filter((_, index) => 'sellerLeadId' in results[index])
    expect(committed).toHaveLength(1)
    expect(committed).toContainEqual((await currentOrder()).map((photo) => photo.id))
    expect((await currentOrder()).map((photo) => photo.order)).toEqual([0, 1, 2])
    for (const result of results) {
      if ('error' in result) expect(result.error).toContain('Recarga la ficha')
    }
  })
})
