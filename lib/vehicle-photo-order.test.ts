import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma, type PrismaClient } from '@prisma/client'
import { persistVehiclePhotoOrder } from './vehicle-photo-order'

const tx = {
  vehicle: { findUnique: vi.fn() },
  vehiclePhoto: { findMany: vi.fn() },
  $executeRaw: vi.fn(),
}
const transaction = vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
const database = { $transaction: transaction } as unknown as Pick<PrismaClient, '$transaction'>

beforeEach(() => {
  vi.clearAllMocks()
  tx.vehicle.findUnique.mockResolvedValue({ sellerLeadId: 'seller' })
  tx.vehiclePhoto.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
  tx.$executeRaw.mockResolvedValue(2)
})

describe('photo reorder persistence', () => {
  it.each([[], ['a', 'a'], [''], [1], null].map((ids) => ({ ids })))(
    'rejects invalid IDs without opening a transaction: $ids',
    async ({ ids }) => {
      expect(await persistVehiclePhotoOrder(database, 'vehicle', ids)).toHaveProperty('error')
      expect(transaction).not.toHaveBeenCalled()
    }
  )
  it('rejects an empty vehicle identifier', async () => {
    expect(await persistVehiclePhotoOrder(database, '', ['a'])).toHaveProperty('error')
    expect(transaction).not.toHaveBeenCalled()
  })
  it.each([['a'], ['a', 'foreign']].map((ids) => ({ ids })))(
    'rejects incomplete or foreign sets $ids without writing',
    async ({ ids }) => {
      expect(await persistVehiclePhotoOrder(database, 'vehicle', ids)).toHaveProperty('error')
      expect(tx.$executeRaw).not.toHaveBeenCalled()
    }
  )
  it('rejects an absent vehicle', async () => {
    tx.vehicle.findUnique.mockResolvedValue(null)
    expect(await persistVehiclePhotoOrder(database, 'vehicle', ['a', 'b'])).toHaveProperty('error')
    expect(tx.$executeRaw).not.toHaveBeenCalled()
  })
  it('performs one parameterized, vehicle-scoped UPDATE with zero-based positions', async () => {
    expect(await persistVehiclePhotoOrder(database, 'vehicle', ['b', 'a'])).toEqual({
      sellerLeadId: 'seller',
    })
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    })
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    const query = tx.$executeRaw.mock.calls[0][0] as Prisma.Sql
    expect(query.values).toEqual(['b', 0, 'a', 1, 'vehicle'])
    expect(query.text).toContain('photo.vehicle_id = $5')
    expect(tx.vehiclePhoto.findMany).toHaveBeenCalledWith({
      where: { vehicleId: 'vehicle' },
      select: { id: true },
    })
  })
  it('throws inside the transaction to roll back an unexpected row count', async () => {
    tx.$executeRaw.mockResolvedValue(1)
    expect(await persistVehiclePhotoOrder(database, 'vehicle', ['a', 'b'])).toHaveProperty('error')
  })
  it.each([
    { code: 'P2034' },
    { code: 'P2010', meta: { code: '40001' } },
    { code: 'P2010', meta: { code: '40P01' } },
  ])('reports serialization/deadlock conflicts without retrying writes: %j', async (details) => {
    tx.$executeRaw.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('conflict', { ...details, clientVersion: '6' })
    )
    expect(await persistVehiclePhotoOrder(database, 'vehicle', ['a', 'b'])).toHaveProperty('error')
    expect(transaction).toHaveBeenCalledTimes(1)
  })
  it('does not swallow unexpected database failures', async () => {
    tx.$executeRaw.mockRejectedValueOnce(new Error('unexpected'))
    await expect(persistVehiclePhotoOrder(database, 'vehicle', ['a', 'b'])).rejects.toThrow(
      'unexpected'
    )
  })
})
