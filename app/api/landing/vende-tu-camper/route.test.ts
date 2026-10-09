import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { landingPayload } from '@/tests/fixtures/landing-seller'

const mocks = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/landing/seller-intake', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/landing/seller-intake')>()),
  saveLandingSeller: mocks.save,
}))
import { POST } from './route'
import { LandingRateLimitError } from '@/lib/landing/seller-intake'

function request(
  body: unknown = landingPayload(),
  origin = 'https://campersnova.com',
  type = 'application/json'
) {
  return new NextRequest('https://campersnova.com/api/landing/vende-tu-camper', {
    method: 'POST',
    headers: { origin, 'content-type': type, 'x-forwarded-for': '192.0.2.1' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('landing API boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.save.mockResolvedValue(undefined)
  })
  it('accepts valid consented input without exposing IDs or contact data', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.save).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ nombre: 'Prueba técnica' }),
      '192.0.2.1'
    )
  })
  it.each(['https://evil.example', 'null', ''])(
    'rejects origin %s before persistence',
    async (origin) => {
      expect((await POST(request(landingPayload(), origin))).status).toBe(403)
      expect(mocks.save).not.toHaveBeenCalled()
    }
  )
  it('rejects non-JSON, malformed, oversized and unconsented requests', async () => {
    expect(
      (await POST(request(landingPayload(), 'https://campersnova.com', 'text/plain'))).status
    ).toBe(415)
    expect((await POST(request('{'))).status).toBe(400)
    expect((await POST(request('x'.repeat(16 * 1024 + 1)))).status).toBe(413)
    expect((await POST(request({ ...landingPayload(), gdpr_consent: false }))).status).toBe(400)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('returns quota errors and safely handles persistence failure', async () => {
    mocks.save.mockRejectedValueOnce(new LandingRateLimitError())
    expect((await POST(request())).status).toBe(429)
    mocks.save.mockRejectedValueOnce(new Error('sensitive database details'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false, error: 'unavailable' })
    expect(log).toHaveBeenCalledWith('[landing/seller] persistence failed')
    log.mockRestore()
  })
})
