import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { landingPayload } from '@/tests/fixtures/landing-seller'

const mocks = vi.hoisted(() => ({ save: vi.fn(), saveMeta: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/landing/seller-intake', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/landing/seller-intake')>()),
  saveLandingSeller: mocks.save,
  saveMetaSeller: mocks.saveMeta,
}))
import { POST } from './route'
import { LandingRateLimitError } from '@/lib/landing/seller-intake'
import { metaSellerPayload } from '@/tests/fixtures/meta-seller'

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

describe('Meta seller relay', () => {
  const token = 's'.repeat(32)

  function metaRequest(body: unknown, credential?: string, origin?: string) {
    return new NextRequest('https://campersnova.com/api/landing/vende-tu-camper', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(credential && { authorization: `Bearer ${credential}` }),
        ...(origin && { origin }),
      },
      body: JSON.stringify(body),
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('META_SELLER_INTAKE_KEY', token)
    vi.stubEnv('META_BUYER_INTAKE_KEY', 'b'.repeat(32))
    mocks.saveMeta.mockResolvedValue(undefined)
  })
  afterEach(() => vi.unstubAllEnvs())

  it('accepts an authenticated lead for the owner form, with no browser origin', async () => {
    const data = metaSellerPayload()
    const response = await POST(metaRequest(data, token))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.saveMeta).toHaveBeenCalledWith({}, data)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('rejects the buyer key, missing auth, invalid seller key and a disabled seller key', async () => {
    const data = metaSellerPayload()
    expect((await POST(metaRequest(data, 'b'.repeat(32)))).status).toBe(401)
    expect((await POST(metaRequest(data))).status).toBe(403)
    expect((await POST(metaRequest(data, 'wrong', 'https://campersnova.com'))).status).toBe(401)
    vi.stubEnv('META_SELLER_INTAKE_KEY', undefined)
    expect((await POST(metaRequest(data, token))).status).toBe(401)
    expect(mocks.saveMeta).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('refuses the buyer form ID and numeric IDs that could lose precision', async () => {
    const data = metaSellerPayload()
    for (const payload of [
      { ...data, form_id: '3364123057107449' },
      { ...data, form_id: Number(data.form_id) },
      { ...data, lead_id: Number(data.lead_id) },
    ]) {
      expect((await POST(metaRequest(payload, token))).status).toBe(400)
    }
    expect(mocks.saveMeta).not.toHaveBeenCalled()
  })
})
