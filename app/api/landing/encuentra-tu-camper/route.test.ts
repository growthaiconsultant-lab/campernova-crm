import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { landingBuyerPayload } from '@/tests/fixtures/landing-buyer'

const mocks = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/landing/buyer-intake', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/landing/buyer-intake')>()),
  saveLandingBuyer: mocks.save,
}))
import { POST } from './route'
import { LandingRateLimitError } from '@/lib/landing/seller-intake'

function request(
  body: unknown = landingBuyerPayload(),
  origin = 'https://campersnova.com',
  type = 'application/json'
) {
  return new NextRequest('https://campersnova.com/api/landing/encuentra-tu-camper', {
    method: 'POST',
    headers: { origin, 'content-type': type, 'x-forwarded-for': '192.0.2.1' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('landing API boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('META_BUYER_INTAKE_KEY', '')
    mocks.save.mockResolvedValue(undefined)
  })
  afterEach(() => vi.unstubAllEnvs())
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
      expect((await POST(request(landingBuyerPayload(), origin))).status).toBe(403)
      expect(mocks.save).not.toHaveBeenCalled()
    }
  )
  it('rejects non-JSON, malformed, oversized and unconsented requests', async () => {
    expect(
      (await POST(request(landingBuyerPayload(), 'https://campersnova.com', 'text/plain'))).status
    ).toBe(415)
    expect((await POST(request('{'))).status).toBe(400)
    expect((await POST(request('x'.repeat(16 * 1024 + 1)))).status).toBe(413)
    expect((await POST(request({ ...landingBuyerPayload(), gdpr_consent: false }))).status).toBe(
      400
    )
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
    expect(log).toHaveBeenCalledWith('[landing/buyer] persistence failed')
    log.mockRestore()
  })

  const testKey = 'test-only-buyer-relay-key-32-characters'
  function relay(authorization = `Bearer ${testKey}`, body: unknown = leadAdsPayload()) {
    const req = request(body, '')
    req.headers.delete('origin')
    req.headers.set('authorization', authorization)
    return req
  }
  function leadAdsPayload() {
    const p = landingBuyerPayload('meta_12345')
    return {
      ...p,
      respuestas: {
        ...p.respuestas,
        atribucion: {
          utm_source: 'facebook',
          utm_medium: 'lead_ads',
          utm_campaign: 'CN · Encuentra tu camper · oct 2026',
        },
      },
    }
  }
  it('accepts authenticated Lead Ads without Origin and does not store the relay IP as consent', async () => {
    vi.stubEnv('META_BUYER_INTAKE_KEY', testKey)
    const response = await POST(relay())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.save).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ respuestas: expect.objectContaining({ event_id: 'meta_12345' }) }),
      null,
      expect.any(Date),
      { leadAds: true }
    )
  })
  it.each(['', 'short-configured-key'])(
    'fails closed when relay configuration is missing or too short (%s)',
    async (key) => {
      vi.stubEnv('META_BUYER_INTAKE_KEY', key)
      expect((await POST(relay())).status).toBe(401)
      expect(mocks.save).not.toHaveBeenCalled()
    }
  )
  it.each(['', 'Basic abc', 'Bearer wrong', 'Bearer ', `Bearer ${'x'.repeat(257)}`])(
    'rejects invalid credentials even with a same-origin header (%s)',
    async (authorization) => {
      vi.stubEnv('META_BUYER_INTAKE_KEY', testKey)
      const req = relay(authorization)
      req.headers.set('origin', 'https://campersnova.com')
      const response = await POST(req)
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ ok: false, error: 'unauthorized' })
      expect(mocks.save).not.toHaveBeenCalled()
    }
  )
  it('still rejects unauthenticated server calls when the key is configured', async () => {
    vi.stubEnv('META_BUYER_INTAKE_KEY', testKey)
    expect((await POST(request(leadAdsPayload(), ''))).status).toBe(403)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('requires Lead Ads attribution and preserves all payload checks after authentication', async () => {
    vi.stubEnv('META_BUYER_INTAKE_KEY', testKey)
    const p = leadAdsPayload()
    for (const body of [
      landingBuyerPayload(),
      { ...p, respuestas: { ...p.respuestas, atribucion: { utm_source: 'facebook' } } },
      {
        ...p,
        respuestas: {
          ...p.respuestas,
          atribucion: { utm_source: 'instagram', utm_medium: 'lead_ads' },
        },
      },
      { ...p, gdpr_consent: false },
      { ...p, web_url: 'spam' },
      '{',
    ])
      expect((await POST(relay(`Bearer ${testKey}`, body))).status).toBe(400)
    expect((await POST(relay(`Bearer ${testKey}`, 'x'.repeat(16 * 1024 + 1)))).status).toBe(413)
    const nonJson = relay()
    nonJson.headers.set('content-type', 'text/plain')
    expect((await POST(nonJson)).status).toBe(415)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('returns retryable quota and persistence errors for the relay', async () => {
    vi.stubEnv('META_BUYER_INTAKE_KEY', testKey)
    mocks.save.mockRejectedValueOnce(new LandingRateLimitError())
    expect((await POST(relay())).status).toBe(429)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.save.mockRejectedValueOnce(new Error('private relay failure'))
    expect((await POST(relay())).status).toBe(503)
    expect(log).toHaveBeenCalledWith('[landing/buyer] persistence failed')
    log.mockRestore()
  })
})
