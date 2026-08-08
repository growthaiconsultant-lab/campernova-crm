import { describe, expect, it } from 'vitest'
import { resolveMagicLinkRedirectUrl } from './magic-link-redirect'

describe('resolveMagicLinkRedirectUrl', () => {
  it('usa el despliegue actual en Preview aunque la URL configurada sea localhost', () => {
    expect(
      resolveMagicLinkRedirectUrl({
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'campernova-preview-123.vercel.app',
      })
    ).toBe('https://campernova-preview-123.vercel.app/auth/callback')
  })

  it('mantiene la URL canónica en producción', () => {
    expect(
      resolveMagicLinkRedirectUrl({
        NEXT_PUBLIC_APP_URL: 'https://crm.campersnova.com/',
        VERCEL_ENV: 'production',
        VERCEL_URL: 'campernova-production-123.vercel.app',
      })
    ).toBe('https://crm.campersnova.com/auth/callback')
  })

  it('rechaza un VERCEL_URL que no sea un host de despliegue', () => {
    expect(
      resolveMagicLinkRedirectUrl({
        NEXT_PUBLIC_APP_URL: 'https://crm.example.com',
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'evil.example.com/path',
      })
    ).toBe('https://crm.example.com/auth/callback')
  })

  it('usa localhost como fallback de desarrollo ante una URL configurada inválida', () => {
    expect(resolveMagicLinkRedirectUrl({ NEXT_PUBLIC_APP_URL: 'not-a-url' })).toBe(
      'http://localhost:3000/auth/callback'
    )
  })
})
