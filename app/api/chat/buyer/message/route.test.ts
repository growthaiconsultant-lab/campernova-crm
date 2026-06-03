import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    buyerChatSession: { findUnique: vi.fn(), update: vi.fn() },
    buyerLead: { create: vi.fn() },
    activity: { create: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: vi.fn(() => 'mock-model') }))

// Mock del Vercel AI SDK: streamText no llama a la red; devolvemos un objeto con
// toTextStreamResponse y dejamos accesible la config (tools/system) para inspección.
const streamTextMock = vi.fn((cfg: unknown) => {
  void cfg // el parámetro existe para tipar mock.calls; se inspecciona en los tests
  return { toTextStreamResponse: () => new Response('stream-ok', { status: 200 }) }
})
vi.mock('ai', () => ({
  streamText: (cfg: unknown) => streamTextMock(cfg),
  tool: (def: unknown) => def,
  stepCountIs: (n: number) => n,
}))
vi.mock('@/lib/email/send', () => ({ sendBuyerChatLeadNotification: vi.fn() }))

import { POST } from './route'

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return {
    json: async () => body,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.buyerChatSession.update.mockResolvedValue({})
  mockDb.user.findMany.mockResolvedValue([])
})

describe('POST /api/chat/buyer/message — guardas', () => {
  it('400 si falta sessionToken o mensaje', async () => {
    const res = await POST(makeReq({ sessionToken: '', message: '' }))
    expect(res.status).toBe(400)
    expect(mockDb.buyerChatSession.findUnique).not.toHaveBeenCalled()
  })

  it('404 si la sesión no existe', async () => {
    mockDb.buyerChatSession.findUnique.mockResolvedValue(null)
    const res = await POST(makeReq({ sessionToken: 'csk_x', message: 'hola' }))
    expect(res.status).toBe(404)
  })

  it('409 si la sesión no está IN_PROGRESS', async () => {
    mockDb.buyerChatSession.findUnique.mockResolvedValue({ status: 'COMPLETED', messages: [] })
    const res = await POST(makeReq({ sessionToken: 'csk_x', message: 'hola' }))
    expect(res.status).toBe(409)
  })

  it('409 si se alcanzó el límite de turnos', async () => {
    const messages = Array.from({ length: 10 }, () => ({
      role: 'user',
      content: 'x',
      timestamp: '',
    }))
    mockDb.buyerChatSession.findUnique.mockResolvedValue({ status: 'IN_PROGRESS', messages })
    const res = await POST(makeReq({ sessionToken: 'csk_x', message: 'hola' }))
    expect(res.status).toBe(409)
  })
})

describe('POST /api/chat/buyer/message — flujo correcto', () => {
  beforeEach(() => {
    mockDb.buyerChatSession.findUnique.mockResolvedValue({ status: 'IN_PROGRESS', messages: [] })
  })

  it('persiste el mensaje del usuario (trim) antes de invocar al modelo', async () => {
    const res = await POST(
      makeReq({ sessionToken: 'csk_x', message: '  Busco una camper para 2  ' })
    )
    expect(res.status).toBe(200)
    expect(mockDb.buyerChatSession.update).toHaveBeenCalled()
    const data = mockDb.buyerChatSession.update.mock.calls[0]![0].data
    const persisted = data.messages.at(-1)
    expect(persisted.role).toBe('user')
    expect(persisted.content).toBe('Busco una camper para 2')
  })

  it('registra el tool register_buyer_lead y pasa el system prompt', async () => {
    await POST(makeReq({ sessionToken: 'csk_x', message: 'hola' }))
    expect(streamTextMock).toHaveBeenCalledTimes(1)
    const cfg = streamTextMock.mock.calls[0]![0] as {
      tools: Record<string, unknown>
      system: string
    }
    expect(cfg.tools.register_buyer_lead).toBeDefined()
    expect(cfg.system).toContain('CampersNova')
  })

  it('el execute del tool crea el BuyerLead con source CHAT', async () => {
    const txCreate = vi.fn().mockResolvedValue({ id: 'lead-1', name: 'Ana', email: 'a@b.com' })
    mockDb.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        buyerLead: { create: txCreate },
        buyerChatSession: { update: vi.fn() },
        activity: { create: vi.fn() },
      })
    )

    await POST(makeReq({ sessionToken: 'csk_x', message: 'hola' }))
    const cfg = streamTextMock.mock.calls[0]![0] as {
      tools: { register_buyer_lead: { execute: (d: unknown) => Promise<unknown> } }
    }

    const out = await cfg.tools.register_buyer_lead.execute({
      nombre: 'Ana López',
      email: 'ana@example.com',
      telefono: '600111222',
      necesidad: 'camper para 2',
      tipo: 'CAMPER',
    })

    expect(out).toEqual({ ok: true })
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1)
    const createArg = txCreate.mock.calls[0]![0].data
    expect(createArg.source).toBe('CHAT')
    expect(createArg.name).toBe('Ana López')
    expect(createArg.vehicleType).toBe('CAMPER')
  })
})
