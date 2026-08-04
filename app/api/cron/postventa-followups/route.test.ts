import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  send: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    postventaFollowup: {
      findMany: mocks.findMany,
      update: mocks.update,
      updateMany: mocks.updateMany,
    },
  },
}))

vi.mock('@/lib/email/client', () => ({
  getResend: () => ({ emails: { send: mocks.send } }),
}))

vi.mock('@/lib/email/templates/postventa-day-7', () => ({
  postventaDay7Html: () => '<p>día 7</p>',
}))

vi.mock('@/lib/email/templates/postventa-day-30', () => ({
  postventaDay30Html: () => '<p>día 30</p>',
}))

import { GET } from './route'

const request = (authorization?: string) =>
  new Request('https://campernova-crm.vercel.app/api/cron/postventa-followups', {
    headers: authorization ? { authorization } : undefined,
  })

describe('GET /api/cron/postventa-followups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'test-secret')
    mocks.findMany.mockResolvedValue([])
    mocks.update.mockResolvedValue({})
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.send.mockResolvedValue({ data: { id: 'email-1' }, error: null })
  })

  it.each([undefined, 'Bearer incorrecto'])(
    'rechaza sin ejecutar efectos cuando Authorization=%s',
    async (authorization) => {
      const response = await GET(request(authorization))

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
      expect(mocks.findMany).not.toHaveBeenCalled()
      expect(mocks.send).not.toHaveBeenCalled()
    }
  )

  it('falla cerrado cuando CRON_SECRET no está configurado', async () => {
    vi.stubEnv('CRON_SECRET', '')

    const response = await GET(request('Bearer '))

    expect(response.status).toBe(401)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('acepta el secreto válido y responde JSON sin redirect', async () => {
    const response = await GET(request('Bearer test-secret'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    await expect(response.json()).resolves.toEqual({ sent: 0, failed: 0, total: 0 })
  })

  it('usa una clave de idempotencia estable por follow-up', async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: 'followup-1',
        type: 'DIA_7',
        warranty: {
          vehicle: { brand: 'Adria', model: 'Twin' },
          buyerLead: { name: 'Ana', email: 'ana@example.com' },
        },
      },
    ])

    await GET(request('Bearer test-secret'))
    await GET(request('Bearer test-secret'))

    expect(mocks.send).toHaveBeenCalledTimes(2)
    expect(mocks.send.mock.calls[0][1]).toEqual({
      idempotencyKey: 'postventa-followup/followup-1',
    })
    expect(mocks.send.mock.calls[1][1]).toEqual(mocks.send.mock.calls[0][1])
  })
})
