import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb } = vi.hoisted(() => ({
  mockDb: { buyerChatSession: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))

import { GET } from './route'

function makeReq(params: Record<string, string>) {
  return {
    nextUrl: { searchParams: new URLSearchParams(params) },
  } as unknown as Parameters<typeof GET>[0]
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/chat/buyer/status', () => {
  it('400 si falta el sessionToken', async () => {
    const res = await GET(makeReq({}))
    expect(res.status).toBe(400)
    expect(mockDb.buyerChatSession.findUnique).not.toHaveBeenCalled()
  })

  it('404 si la sesión no existe', async () => {
    mockDb.buyerChatSession.findUnique.mockResolvedValue(null)
    const res = await GET(makeReq({ sessionToken: 'csk_x' }))
    expect(res.status).toBe(404)
  })

  it('devuelve { status, buyerLeadId } de la sesión', async () => {
    mockDb.buyerChatSession.findUnique.mockResolvedValue({
      status: 'COMPLETED',
      buyerLeadId: 'lead-1',
    })
    const res = await GET(makeReq({ sessionToken: 'csk_x' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'COMPLETED', buyerLeadId: 'lead-1' })
  })
})
