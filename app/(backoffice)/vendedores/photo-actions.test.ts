import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireCanGenerateAds: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/storage', () => ({
  VEHICLE_PHOTOS_BUCKET: 'vehicle-photos',
  extractVehiclePhotoPath: vi.fn(),
  vehiclePhotoPath: vi.fn(),
  vehiclePhotoPublicUrl: vi.fn(),
}))

const { mockDb } = vi.hoisted(() => ({
  mockDb: { vehiclePhoto: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { revalidatePath } from 'next/cache'
import { setVehiclePhotoCategory } from './photo-actions'

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.vehiclePhoto.update.mockResolvedValue({})
})

describe('setVehiclePhotoCategory', () => {
  it('resuelve Photo → Vehicle → SellerLead y actualiza la categoría; revalida la ficha', async () => {
    mockDb.vehiclePhoto.findUnique.mockResolvedValue({ id: 'p1', vehicle: { sellerLeadId: 's1' } })
    const res = await setVehiclePhotoCategory('p1', 'EXTERIOR')
    expect(res).toEqual({ ok: true })
    expect(mockDb.vehiclePhoto.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { category: 'EXTERIOR' },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/vendedores/s1')
  })

  it('null limpia la categoría (sin clasificar)', async () => {
    mockDb.vehiclePhoto.findUnique.mockResolvedValue({ id: 'p1', vehicle: { sellerLeadId: 's1' } })
    const res = await setVehiclePhotoCategory('p1', null)
    expect(res).toEqual({ ok: true })
    expect(mockDb.vehiclePhoto.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { category: null },
    })
  })

  it('categoría inválida → error, sin escribir', async () => {
    const res = await setVehiclePhotoCategory('p1', 'INVALIDA' as never)
    expect('error' in res).toBe(true)
    expect(mockDb.vehiclePhoto.update).not.toHaveBeenCalled()
  })

  it('foto inexistente → error', async () => {
    mockDb.vehiclePhoto.findUnique.mockResolvedValue(null)
    const res = await setVehiclePhotoCategory('px', 'INTERIOR')
    expect('error' in res).toBe(true)
    expect(mockDb.vehiclePhoto.update).not.toHaveBeenCalled()
  })
})
