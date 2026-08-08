import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireCanEditReceptionCommercial: vi.fn(),
  requireCanEditReceptionTechnical: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: { vehicle: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/locking', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/locking')>()
  return { ...actual, withLockedRoots: vi.fn() }
})
vi.mock('@/lib/vehicle-reception/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/vehicle-reception/service')>()
  return {
    ...actual,
    saveCommercialReceptionTx: vi.fn(),
    saveTechnicalReceptionTx: vi.fn(),
    reviewReceptionSectionTx: vi.fn(),
  }
})
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { requireCanEditReceptionCommercial, requireCanEditReceptionTechnical } from '@/lib/auth'
import { db } from '@/lib/db'
import { withLockedRoots } from '@/lib/locking'
import {
  reviewReceptionSectionTx,
  saveCommercialReceptionTx,
} from '@/lib/vehicle-reception/service'
import { reviewReceptionSection, saveCommercialReception } from './actions'

const commercialInput = {
  expectedRevision: 0,
  name: null,
  email: null,
  phone: null,
  receptionDate: null,
  previousOwners: null,
  maintenanceHistoryAvailable: null,
  saleReason: null,
  minPrice: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCanEditReceptionCommercial).mockResolvedValue({ id: 'admin' } as never)
  vi.mocked(requireCanEditReceptionTechnical).mockResolvedValue({ id: 'taller' } as never)
  vi.mocked(db.vehicle.findUnique).mockResolvedValue({ sellerLeadId: 'seller-1' } as never)
  vi.mocked(withLockedRoots).mockImplementation(async (_roots, operation) => operation({} as never))
  vi.mocked(saveCommercialReceptionTx).mockResolvedValue({
    revision: 1,
    status: 'BORRADOR',
  })
  vi.mocked(reviewReceptionSectionTx).mockResolvedValue({
    status: 'BORRADOR',
    completedAt: null,
    commercialReviewed: false,
    technicalReviewed: true,
  })
})

describe('autorización server-side del cuestionario', () => {
  it('autoriza Comercial antes de consultar o escribir su sección', async () => {
    await saveCommercialReception('vehicle-1', commercialInput)
    expect(requireCanEditReceptionCommercial).toHaveBeenCalledOnce()
    expect(requireCanEditReceptionTechnical).not.toHaveBeenCalled()
    expect(saveCommercialReceptionTx).toHaveBeenCalledOnce()
  })

  it('si el guard Comercial deniega, no consulta ni escribe', async () => {
    vi.mocked(requireCanEditReceptionCommercial).mockRejectedValueOnce(new Error('forbidden'))
    await expect(saveCommercialReception('vehicle-1', commercialInput)).rejects.toThrow('forbidden')
    expect(db.vehicle.findUnique).not.toHaveBeenCalled()
    expect(withLockedRoots).not.toHaveBeenCalled()
  })

  it('revisar Técnica usa sólo el guard técnico', async () => {
    await reviewReceptionSection('vehicle-1', { section: 'technical', expectedRevision: 0 })
    expect(requireCanEditReceptionTechnical).toHaveBeenCalledOnce()
    expect(requireCanEditReceptionCommercial).not.toHaveBeenCalled()
    expect(reviewReceptionSectionTx).toHaveBeenCalledWith(
      expect.anything(),
      'taller',
      'vehicle-1',
      'technical',
      0
    )
  })

  it('revisar Comercial no acepta el guard técnico como sustituto', async () => {
    await reviewReceptionSection('vehicle-1', { section: 'commercial', expectedRevision: 0 })
    expect(requireCanEditReceptionCommercial).toHaveBeenCalledOnce()
    expect(requireCanEditReceptionTechnical).not.toHaveBeenCalled()
  })

  it('rechaza una sección fabricada antes de ejecutar guards', async () => {
    const result = await reviewReceptionSection('vehicle-1', {
      section: 'economia',
      expectedRevision: 0,
    })
    expect(result.ok).toBe(false)
    expect(requireCanEditReceptionCommercial).not.toHaveBeenCalled()
    expect(requireCanEditReceptionTechnical).not.toHaveBeenCalled()
  })
})
