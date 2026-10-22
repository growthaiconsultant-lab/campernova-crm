import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), merge: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAdmin: mocks.auth }))
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/buyer-merge', () => ({ mergeBuyerLeads: mocks.merge }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
import { unifyBuyerContacts } from './actions'
beforeEach(() => {
  vi.resetAllMocks()
})
describe('administrative buyer merge boundary', () => {
  it('denies before parsing data or starting a merge', async () => {
    mocks.auth.mockRejectedValue(new Error('forbidden'))
    await expect(unifyBuyerContacts(new FormData())).rejects.toThrow('forbidden')
    expect(mocks.merge).not.toHaveBeenCalled()
  })
  it('rejects an incomplete preview even for an admin', async () => {
    mocks.auth.mockResolvedValue({ id: 'admin' })
    await expect(unifyBuyerContacts(new FormData())).rejects.toThrow()
    expect(mocks.merge).not.toHaveBeenCalled()
  })
})
