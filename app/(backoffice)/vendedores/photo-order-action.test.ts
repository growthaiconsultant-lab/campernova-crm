import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireCanGenerateAds: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/vehicle-photo-order', () => ({ persistVehiclePhotoOrder: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { requireCanGenerateAds } from '@/lib/auth'
import { persistVehiclePhotoOrder } from '@/lib/vehicle-photo-order'
import { revalidatePath } from 'next/cache'
import { reorderVehiclePhotos } from './photo-actions'

beforeEach(() => vi.resetAllMocks())

describe('reorder server authorization', () => {
  it('checks permissions even for malformed inputs before invoking persistence', async () => {
    vi.mocked(requireCanGenerateAds).mockRejectedValue(new Error('forbidden'))
    await expect(reorderVehiclePhotos('', [])).rejects.toThrow('forbidden')
    expect(persistVehiclePhotoOrder).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('invalidates only the resolved seller after a successful commit', async () => {
    vi.mocked(persistVehiclePhotoOrder).mockResolvedValue({ sellerLeadId: 'seller-qa' })
    expect(await reorderVehiclePhotos('v', ['p'])).toEqual({ ok: true })
    expect(requireCanGenerateAds).toHaveBeenCalledTimes(1)
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/vendedores/seller-qa')
  })
  it('propagates recoverable errors without invalidating or retrying', async () => {
    vi.mocked(persistVehiclePhotoOrder).mockResolvedValue({ error: 'conflict' })
    expect(await reorderVehiclePhotos('v', ['p'])).toEqual({ error: 'conflict' })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(persistVehiclePhotoOrder).toHaveBeenCalledTimes(1)
  })
})
