import { describe, expect, it, vi } from 'vitest'
import { createWarrantyForDelivery } from './create-warranty'

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    delivery: {
      findUnique: vi.fn(),
    },
    warranty: {
      create: vi.fn().mockResolvedValue({ id: 'warranty-1' }),
    },
    postventaFollowup: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    ...overrides,
  }
}

const BASE_DELIVERY = {
  vehicleId: 'vehicle-1',
  buyerLeadId: 'buyer-1',
  completedAt: new Date('2026-05-01T10:00:00Z'),
}

describe('createWarrantyForDelivery', () => {
  it('crea warranty con endDate = startDate + 12 meses', async () => {
    const db = makeDb()
    db.delivery.findUnique.mockResolvedValue(BASE_DELIVERY)

    await createWarrantyForDelivery('delivery-1', db as never)

    expect(db.warranty.create).toHaveBeenCalledOnce()
    const { data } = db.warranty.create.mock.calls[0][0]
    expect(data.startDate).toEqual(BASE_DELIVERY.completedAt)
    const expectedEnd = new Date(BASE_DELIVERY.completedAt)
    expectedEnd.setFullYear(expectedEnd.getFullYear() + 1)
    expect(data.endDate).toEqual(expectedEnd)
    expect(data.vehicleId).toBe('vehicle-1')
    expect(data.buyerLeadId).toBe('buyer-1')
  })

  it('crea 2 followups: DIA_7 y DIA_30', async () => {
    const db = makeDb()
    db.delivery.findUnique.mockResolvedValue(BASE_DELIVERY)

    await createWarrantyForDelivery('delivery-1', db as never)

    expect(db.postventaFollowup.createMany).toHaveBeenCalledOnce()
    const { data } = db.postventaFollowup.createMany.mock.calls[0][0]
    expect(data).toHaveLength(2)

    const day7 = new Date(BASE_DELIVERY.completedAt)
    day7.setDate(day7.getDate() + 7)
    const day30 = new Date(BASE_DELIVERY.completedAt)
    day30.setDate(day30.getDate() + 30)

    expect(data[0].type).toBe('DIA_7')
    expect(data[0].scheduledFor).toEqual(day7)
    expect(data[1].type).toBe('DIA_30')
    expect(data[1].scheduledFor).toEqual(day30)
  })

  it('lanza si la entrega no tiene completedAt', async () => {
    const db = makeDb()
    db.delivery.findUnique.mockResolvedValue({ ...BASE_DELIVERY, completedAt: null })

    await expect(createWarrantyForDelivery('delivery-1', db as never)).rejects.toThrow(
      'Delivery not completed'
    )
  })

  it('lanza si la entrega no existe', async () => {
    const db = makeDb()
    db.delivery.findUnique.mockResolvedValue(null)

    await expect(createWarrantyForDelivery('delivery-1', db as never)).rejects.toThrow()
  })
})
