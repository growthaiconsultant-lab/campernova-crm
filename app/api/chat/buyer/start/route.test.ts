import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockDb } = vi.hoisted(() => ({
  mockDb: { buyerChatSession: { count: vi.fn(), create: vi.fn() } },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { POST } from './route'
import { BUYER_GREETING } from '@/lib/chat/system-prompt'

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return {
    json: async () => body,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.buyerChatSession.create.mockResolvedValue({ sessionToken: 'csk_test' })
})
afterEach(() => vi.unstubAllEnvs())

describe('POST /api/chat/buyer/start', () => {
  it('crea la sesión y devuelve el saludo inicial', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionToken).toBe('csk_test')
    expect(body.greeting).toBe(BUYER_GREETING)
    expect(mockDb.buyerChatSession.create).toHaveBeenCalledTimes(1)
  })

  it('en dev no aplica rate-limit (no consulta count)', async () => {
    await POST(makeReq({}, { 'x-forwarded-for': '9.9.9.9' }))
    expect(mockDb.buyerChatSession.count).not.toHaveBeenCalled()
  })

  it('en producción devuelve 429 si la IP supera el límite diario', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mockDb.buyerChatSession.count.mockResolvedValue(50)
    const res = await POST(makeReq({}, { 'x-forwarded-for': '8.8.8.8' }))
    expect(res.status).toBe(429)
    expect(mockDb.buyerChatSession.create).not.toHaveBeenCalled()
  })

  it('en producción crea la sesión si está por debajo del límite', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mockDb.buyerChatSession.count.mockResolvedValue(3)
    const res = await POST(makeReq({}, { 'x-forwarded-for': '8.8.8.8' }))
    expect(res.status).toBe(200)
    expect(mockDb.buyerChatSession.create).toHaveBeenCalledTimes(1)
  })
})
