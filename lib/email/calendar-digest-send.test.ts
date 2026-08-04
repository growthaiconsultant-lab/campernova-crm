import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ send: vi.fn() }))

vi.mock('./client', () => ({
  getResend: () => ({ emails: { send: mocks.send } }),
}))

import { sendCalendarDigest } from './send'

const params = {
  to: 'joel@example.com',
  userName: 'Joel',
  dateLabel: 'miércoles, 5 de agosto',
  idempotencyKey: 'calendar-digest/2026-08-05/user-1',
  items: [
    {
      kindLabel: 'Cita',
      title: 'Visita',
      timeLabel: '10:00',
      contextLabel: null,
      href: '/calendario/event-1',
    },
  ],
}

describe('sendCalendarDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('EMAIL_FROM', 'crm@example.com')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://crm.example.com')
  })

  it('entrega la clave de idempotencia a Resend', async () => {
    mocks.send.mockResolvedValue({ data: { id: 'email-1' }, error: null })

    await expect(sendCalendarDigest(params)).resolves.toBe(true)
    expect(mocks.send).toHaveBeenCalledOnce()
    expect(mocks.send.mock.calls[0][1]).toEqual({
      idempotencyKey: 'calendar-digest/2026-08-05/user-1',
    })
  })

  it('devuelve false si Resend rechaza la petición', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.send.mockResolvedValue({ data: null, error: { name: 'validation_error' } })

    await expect(sendCalendarDigest(params)).resolves.toBe(false)
  })
})
