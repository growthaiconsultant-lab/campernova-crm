import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { searchPayload } from '@/tests/fixtures/search-request'
const mocks = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/search-request/intake', async (original) => ({
  ...(await original<typeof import('@/lib/search-request/intake')>()),
  saveSearchRequest: mocks.save,
}))
import { POST } from './route'
import { LandingRateLimitError } from '@/lib/landing/seller-intake'
import { SearchRequestConflict } from '@/lib/search-request/intake'
function request(
  body: unknown = searchPayload(),
  origin = 'https://campersnova.com',
  type = 'application/json'
) {
  return new NextRequest('https://campersnova.com/api/landing/busqueda-bajo-pedido', {
    method: 'POST',
    headers: { origin, 'content-type': type, 'x-forwarded-for': '192.0.2.10' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}
describe('public search request boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.save.mockResolvedValue(undefined)
  })
  it('returns confirmation only after persistence, without personal data or CRM IDs', async () => {
    const response = await POST(request())
    expect(await response.json()).toEqual({ ok: true })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.save).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ consent: true }),
      '192.0.2.10'
    )
  })
  it.each(['https://evil.example', '', 'null'])('rejects origin %s', async (origin) => {
    expect((await POST(request(searchPayload(), origin))).status).toBe(403)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('rejects malformed, oversized, non-JSON and unconsented input', async () => {
    expect((await POST(request('{'))).status).toBe(400)
    expect((await POST(request('x'.repeat(32769)))).status).toBe(413)
    expect(
      (await POST(request(searchPayload(), 'https://campersnova.com', 'text/plain'))).status
    ).toBe(415)
    expect((await POST(request({ ...searchPayload(), consent: false }))).status).toBe(400)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('handles quota, conflict and unavailable database without leaking errors', async () => {
    mocks.save.mockRejectedValueOnce(new LandingRateLimitError())
    expect((await POST(request())).status).toBe(429)
    mocks.save.mockRejectedValueOnce(new SearchRequestConflict())
    expect((await POST(request())).status).toBe(409)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.save.mockRejectedValueOnce(new Error('private contact or credentials'))
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false, error: 'unavailable' })
    expect(spy).toHaveBeenCalledWith('[search-request] persistence failed')
    spy.mockRestore()
  })
})
