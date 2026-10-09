import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const mocks = vi.hoisted(() => ({ updateSession: vi.fn() }))
vi.mock('@/lib/supabase/middleware', () => ({ updateSession: mocks.updateSession }))
import { middleware } from '../../middleware'

describe('campaign public routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRM_HOST', '')
    mocks.updateSession.mockResolvedValue({ supabaseResponse: NextResponse.next(), user: null })
  })
  it.each([
    '/vende-tu-camper.html',
    '/encuentra-tu-camper.html',
    '/cn-landing/cn-landing.js',
    '/cn-landing/cn-landing.css',
    '/cn-landing/fonts/Inter-latin.woff2',
    '/cn-landing/media/v-sprinter.mp4',
    '/api/landing/vende-tu-camper',
    '/api/landing/encuentra-tu-camper',
  ])('serves %s without an auth lookup', async (path) => {
    const response = await middleware(new NextRequest(`https://campersnova.com${path}`))
    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(mocks.updateSession).not.toHaveBeenCalled()
  })
  it.each(['/vendedores', '/api/landing/other', '/cn-landing-private/file.js', '/private.html'])(
    'keeps %s protected',
    async (path) => {
      expect((await middleware(new NextRequest(`https://campersnova.com${path}`))).status).toBe(307)
      expect(mocks.updateSession).toHaveBeenCalledOnce()
    }
  )
  it('redirects CRM campaign pages to the public host preserving attribution', async () => {
    vi.stubEnv('CRM_HOST', 'crm.campersnova.com')
    const response = await middleware(
      new NextRequest('https://crm.campersnova.com/vende-tu-camper.html?utm_source=ad', {
        headers: { host: 'crm.campersnova.com' },
      })
    )
    expect(response.headers.get('location')).toBe(
      'https://campersnova.com/vende-tu-camper.html?utm_source=ad'
    )
  })
})
