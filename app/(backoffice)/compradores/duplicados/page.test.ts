import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), buyers: vi.fn(), sellers: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAdmin: mocks.auth }))
vi.mock('@/lib/db', () => ({
  db: { buyerLead: { findMany: mocks.buyers }, sellerLead: { findMany: mocks.sellers } },
}))
import Page from './page'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ role: 'ADMIN' })
  mocks.buyers.mockResolvedValue([])
  mocks.sellers.mockResolvedValue([])
})
describe('admin duplicate review', () => {
  it('authorizes before reading contacts', async () => {
    mocks.auth.mockRejectedValue(new Error('forbidden'))
    await expect(Page()).rejects.toThrow('forbidden')
    expect(mocks.buyers).not.toHaveBeenCalled()
    expect(mocks.sellers).not.toHaveBeenCalled()
  })
  it('renders responsible agents and links without disclosing the contact details', async () => {
    mocks.buyers.mockResolvedValue(
      ['a', 'b'].map((agentId, i) => ({
        id: String(i),
        name: `Persona ${i}`,
        phone: '612345678',
        email: 'private@example.com',
        agentId,
        agent: { name: agentId },
        status: 'NUEVO',
        archivedAt: null,
      }))
    )
    const html = renderToStaticMarkup(await Page())
    expect(html).toContain('/compradores/0')
    expect(html).toContain('2 fichas revisadas')
    expect(html).toContain('Persona 1')
    expect(html).not.toContain('612345678')
    expect(html).not.toContain('private@example.com')
  })
})
