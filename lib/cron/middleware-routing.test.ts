import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
}))

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: mocks.updateSession,
}))

import { middleware } from '../../middleware'
import { CONFIGURED_CRON_PATHS } from './routes'

describe('middleware · routing de cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRM_HOST', '')
    mocks.updateSession.mockResolvedValue({
      supabaseResponse: NextResponse.next(),
      user: null,
    })
  })

  it.each(CONFIGURED_CRON_PATHS)(
    'deja pasar la ruta exacta %s sin exigir sesión',
    async (pathname) => {
      const response = await middleware(
        new NextRequest(`https://campernova-crm.vercel.app${pathname}`, {
          headers: { authorization: 'Bearer test-secret' },
        })
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-next')).toBe('1')
      expect(mocks.updateSession).not.toHaveBeenCalled()
    }
  )

  it.each(['/api/cron/desconocida', '/api/cron/calendar-reminders/extra'])(
    'no autoriza por prefijo la ruta cron desconocida %s',
    async (pathname) => {
      const response = await middleware(
        new NextRequest(`https://campernova-crm.vercel.app${pathname}`, {
          headers: { authorization: 'Bearer test-secret' },
        })
      )

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('https://campernova-crm.vercel.app/login')
      expect(mocks.updateSession).toHaveBeenCalledOnce()
    }
  )
})
