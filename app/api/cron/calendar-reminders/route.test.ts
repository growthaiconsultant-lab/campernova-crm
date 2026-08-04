import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCalendarItems: vi.fn(),
  groupItemsByAssignee: vi.fn(),
  findMany: vi.fn(),
  sendCalendarDigest: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: { user: { findMany: mocks.findMany } },
}))

vi.mock('@/lib/calendar/prisma-deps', () => ({
  prismaCalendarDeps: vi.fn(() => ({})),
}))

vi.mock('@/lib/calendar/aggregate', () => ({
  getCalendarItems: mocks.getCalendarItems,
}))

vi.mock('@/lib/calendar/reminders', () => ({
  groupItemsByAssignee: mocks.groupItemsByAssignee,
}))

vi.mock('@/lib/email/send', () => ({
  sendCalendarDigest: mocks.sendCalendarDigest,
}))

import { GET } from './route'

const request = (authorization?: string) =>
  new Request('https://campernova-crm.vercel.app/api/cron/calendar-reminders', {
    headers: authorization ? { authorization } : undefined,
  })

describe('GET /api/cron/calendar-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'test-secret')
    mocks.getCalendarItems.mockResolvedValue([])
    mocks.groupItemsByAssignee.mockReturnValue(new Map())
    mocks.findMany.mockResolvedValue([])
    mocks.sendCalendarDigest.mockResolvedValue(true)
  })

  it.each([undefined, 'Bearer incorrecto'])(
    'rechaza sin ejecutar efectos cuando Authorization=%s',
    async (authorization) => {
      const response = await GET(request(authorization))

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
      expect(mocks.getCalendarItems).not.toHaveBeenCalled()
      expect(mocks.sendCalendarDigest).not.toHaveBeenCalled()
    }
  )

  it('falla cerrado cuando CRON_SECRET no está configurado', async () => {
    vi.stubEnv('CRON_SECRET', '')

    const response = await GET(request('Bearer '))

    expect(response.status).toBe(401)
    expect(mocks.getCalendarItems).not.toHaveBeenCalled()
  })

  it('acepta el secreto válido y responde JSON sin redirect', async () => {
    const response = await GET(request('Bearer test-secret'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    await expect(response.json()).resolves.toEqual({
      sent: 0,
      failed: 0,
      users: 0,
      total: 0,
    })
  })

  it('usa una clave diaria estable por usuario y cuenta fallos reales', async () => {
    const item = {
      id: 'event-1',
      assigneeId: 'user-1',
      kindLabel: 'Cita',
      title: 'Visita',
      allDay: false,
      start: new Date('2026-08-05T10:00:00Z'),
      contextLabel: null,
      href: '/calendario/event-1',
    }
    mocks.getCalendarItems.mockResolvedValue([item])
    mocks.groupItemsByAssignee.mockReturnValue(new Map([['user-1', [item]]]))
    mocks.findMany.mockResolvedValue([{ id: 'user-1', name: 'Joel', email: 'joel@example.com' }])
    mocks.sendCalendarDigest.mockResolvedValue(false)

    const first = await GET(request('Bearer test-secret'))
    const second = await GET(request('Bearer test-secret'))

    expect(await first.json()).toMatchObject({ sent: 0, failed: 1, users: 1 })
    expect(await second.json()).toMatchObject({ sent: 0, failed: 1, users: 1 })
    expect(mocks.sendCalendarDigest).toHaveBeenCalledTimes(2)
    const firstKey = mocks.sendCalendarDigest.mock.calls[0][0].idempotencyKey
    const secondKey = mocks.sendCalendarDigest.mock.calls[1][0].idempotencyKey
    expect(firstKey).toMatch(/^calendar-digest\/\d{4}-\d{2}-\d{2}\/user-1$/)
    expect(secondKey).toBe(firstKey)
  })
})
