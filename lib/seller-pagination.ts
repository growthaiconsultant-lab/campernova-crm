export const SELLERS_PAGE_SIZE = 25

export function sellerPagination(rawPage: string | undefined, total: number) {
  const parsed = Number(rawPage)
  const requested = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
  const totalPages = Math.max(1, Math.ceil(total / SELLERS_PAGE_SIZE))
  const page = Math.min(requested, totalPages)
  return {
    page,
    totalPages,
    skip: (page - 1) * SELLERS_PAGE_SIZE,
    from: total === 0 ? 0 : (page - 1) * SELLERS_PAGE_SIZE + 1,
    to: Math.min(page * SELLERS_PAGE_SIZE, total),
  }
}

export function sellerPageUrl(params: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'page' && value !== undefined && value !== '') query.set(key, value)
  }
  if (page > 1) query.set('page', String(page))
  const suffix = query.toString()
  return `/vendedores${suffix ? `?${suffix}` : ''}`
}
