import { describe, expect, it } from 'vitest'
import { sellerPageUrl, sellerPagination } from './seller-pagination'

describe('sellerPagination', () => {
  it.each([
    [undefined, 61, 1, 0, 1, 25, 3],
    ['2', 61, 2, 25, 26, 50, 3],
    ['3', 61, 3, 50, 51, 61, 3],
    ['999', 61, 3, 50, 51, 61, 3],
    ['2', 0, 1, 0, 0, 0, 1],
    ['1', 25, 1, 0, 1, 25, 1],
  ])(
    'page %s with %i records has a valid range',
    (raw, total, page, skip, from, to, totalPages) => {
      expect(sellerPagination(raw, total)).toEqual({ page, skip, from, to, totalPages })
    }
  )

  it.each(['-1', '0', 'abc', '2oops', '2.5', 'Infinity', '9007199254740992'])(
    'rejects invalid page %s',
    (raw) => {
      expect(sellerPagination(raw, 61).page).toBe(1)
    }
  )

  it('preserves all filters and encodes them while changing only the page', () => {
    const params = {
      q: 'Ana & Juan',
      view: 'stock',
      brand: 'Ford',
      agentId: '__none__',
      sort: 'desiredPrice',
      dir: 'asc',
      page: '9',
      status: undefined,
    }
    const url = new URL(sellerPageUrl(params, 2), 'https://example.test')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'Ana & Juan',
      view: 'stock',
      brand: 'Ford',
      agentId: '__none__',
      sort: 'desiredPrice',
      dir: 'asc',
      page: '2',
    })
    expect(sellerPageUrl({}, 1)).toBe('/vendedores')
    expect(new URL(sellerPageUrl(params, 1), url).searchParams.has('page')).toBe(false)
    expect(params.page).toBe('9')
  })
})
