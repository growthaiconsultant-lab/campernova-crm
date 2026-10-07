import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  buyer: vi.fn(),
  seller: vi.fn(),
  agents: vi.fn(),
  activities: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ requireAgente: mocks.auth }))
vi.mock('@/lib/db', () => ({
  db: {
    buyerLead: { findUnique: mocks.buyer },
    sellerLead: { findUnique: mocks.seller },
    user: { findMany: mocks.agents },
    activity: { findMany: mocks.activities },
  },
}))

import BuyerPage from '@/app/(backoffice)/compradores/[id]/page'
import SellerPage from '@/app/(backoffice)/vendedores/[id]/page'
import { completedSalesQuery } from './completed-sales'

describe('guard y selección de ventas de ambas fichas', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  it.each([
    ['buyer', BuyerPage],
    ['seller', SellerPage],
  ] as const)('no consulta datos sin autorización en %s', async (_side, Page) => {
    mocks.auth.mockRejectedValue(new Error('No autorizado'))
    await expect(Page({ params: { id: 'qa' }, searchParams: {} })).rejects.toThrow('No autorizado')
    expect(mocks.buyer).not.toHaveBeenCalled()
    expect(mocks.seller).not.toHaveBeenCalled()
    expect(mocks.agents).not.toHaveBeenCalled()
    expect(mocks.activities).not.toHaveBeenCalled()
  })
  it('comprador y vendedor seleccionan ventas completadas con el alcance de su ficha', async () => {
    mocks.auth.mockResolvedValue({ id: 'qa-agent', role: 'AGENTE' })
    mocks.buyer.mockResolvedValue(null)
    mocks.seller.mockResolvedValue(null)
    mocks.agents.mockResolvedValue([])
    mocks.activities.mockResolvedValue([])
    await expect(BuyerPage({ params: { id: 'buyer-qa' }, searchParams: {} })).rejects.toThrow()
    await expect(SellerPage({ params: { id: 'seller-qa' }, searchParams: {} })).rejects.toThrow()
    expect(mocks.buyer).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'buyer-qa' },
        include: expect.objectContaining({ deliveries: completedSalesQuery }),
      })
    )
    expect(mocks.seller).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'seller-qa' },
        include: expect.objectContaining({
          vehicle: { include: expect.objectContaining({ deliveries: completedSalesQuery }) },
        }),
      })
    )
  })
})
