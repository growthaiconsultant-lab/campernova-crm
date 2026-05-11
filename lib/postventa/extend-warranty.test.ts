import { describe, expect, it, vi } from 'vitest'
import { extendWarranty } from './extend-warranty'

function makeDb() {
  return {
    warranty: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('extendWarranty', () => {
  it('extiende desde endDate cuando no hay extendedTo', async () => {
    const db = makeDb()
    const endDate = new Date('2027-01-01T00:00:00Z')
    db.warranty.findUnique.mockResolvedValue({ endDate, extendedTo: null })

    await extendWarranty('warranty-1', 12, 'user-1', db as never)

    const { data } = db.warranty.update.mock.calls[0][0]
    const expectedEnd = new Date(endDate)
    expectedEnd.setMonth(expectedEnd.getMonth() + 12)
    expect(data.extendedTo).toEqual(expectedEnd)
    expect(data.extendedById).toBe('user-1')
  })

  it('extiende desde extendedTo cuando ya fue ampliada antes', async () => {
    const db = makeDb()
    const endDate = new Date('2027-01-01T00:00:00Z')
    const extendedTo = new Date('2028-01-01T00:00:00Z')
    db.warranty.findUnique.mockResolvedValue({ endDate, extendedTo })

    await extendWarranty('warranty-1', 6, 'user-1', db as never)

    const { data } = db.warranty.update.mock.calls[0][0]
    const expectedEnd = new Date(extendedTo)
    expectedEnd.setMonth(expectedEnd.getMonth() + 6)
    expect(data.extendedTo).toEqual(expectedEnd)
  })

  it('lanza si la garantía no existe', async () => {
    const db = makeDb()
    db.warranty.findUnique.mockResolvedValue(null)

    await expect(extendWarranty('warranty-1', 12, 'user-1', db as never)).rejects.toThrow(
      'Warranty not found'
    )
  })

  it('guarda extendedAt como fecha actual', async () => {
    const db = makeDb()
    const before = Date.now()
    db.warranty.findUnique.mockResolvedValue({ endDate: new Date(), extendedTo: null })

    await extendWarranty('warranty-1', 6, 'user-1', db as never)

    const { data } = db.warranty.update.mock.calls[0][0]
    expect(data.extendedAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(data.extendedAt.getTime()).toBeLessThanOrEqual(Date.now())
  })
})
