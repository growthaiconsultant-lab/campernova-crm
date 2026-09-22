import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  agents: vi.fn(),
  auth: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: {
    sellerLead: { count: mocks.count, findMany: mocks.findMany },
    user: { findMany: mocks.agents },
  },
}))
vi.mock('@/lib/auth', () => ({ requireAgente: mocks.auth }))
vi.mock('./leads-filters', () => ({ LeadsFilters: () => null }))

import VendedoresPage from './page'

function lead(id: string) {
  return {
    id,
    name: 'Vendedor de prueba',
    createdAt: new Date('2026-01-01'),
    canal: 'CN',
    status: 'NUEVO',
    agent: null,
    vehicle: null,
    dealType: null,
    nextActionType: null,
    nextActionDueAt: null,
  }
}

describe('seller list', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ id: 'qa' })
    mocks.count.mockResolvedValue(61)
    mocks.findMany.mockResolvedValue([lead('seller-a'), lead('seller-b')])
    mocks.agents.mockResolvedValue([])
  })

  it('keeps distinct destinations even for sellers with identical names, in table and cards', async () => {
    const html = renderToStaticMarkup(await VendedoresPage({ searchParams: {} }))
    for (const id of ['seller-a', 'seller-b']) {
      expect(html.match(new RegExp(`href="/vendedores/${id}"`, 'g'))).toHaveLength(2)
    }
    expect(html).toContain('Paginación de vendedores superior')
    expect(html).toContain('Paginación de vendedores inferior')
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        skip: 0,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      })
    )
  })

  it('clamps a stale page and preserves filters on the previous link', async () => {
    const html = renderToStaticMarkup(
      await VendedoresPage({ searchParams: { page: '99', brand: 'Ford', sort: 'updatedAt' } })
    )
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        skip: 50,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      })
    )
    expect(html).toContain('51–61 de 61 vendedores')
    expect(html).toContain('brand=Ford&amp;sort=updatedAt&amp;page=2')
    expect(html).not.toContain('page=4')
    expect(mocks.count.mock.calls[0][0].where).toEqual(mocks.findMany.mock.calls[0][0].where)
  })

  it('shows an empty range without invalid pages or navigation links', async () => {
    mocks.count.mockResolvedValue(0)
    mocks.findMany.mockResolvedValue([])
    const html = renderToStaticMarkup(await VendedoresPage({ searchParams: { page: '9' } }))
    expect(html).toContain('0–0 de 0 vendedores')
    expect(html).toContain('Sin vendedores que mostrar')
    expect(html).not.toContain('Paginación de vendedores inferior')
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }))
  })

  it('does not read records when authorization fails', async () => {
    mocks.auth.mockRejectedValue(new Error('denied'))
    await expect(VendedoresPage({ searchParams: {} })).rejects.toThrow('denied')
    expect(mocks.count).not.toHaveBeenCalled()
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
