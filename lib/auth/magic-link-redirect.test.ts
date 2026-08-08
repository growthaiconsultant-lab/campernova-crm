import { describe, expect, it } from 'vitest'
import { resolveMagicLinkRedirectUrl } from './magic-link-redirect'

describe('resolveMagicLinkRedirectUrl', () => {
  it('usa el alias estable de la rama en Preview aunque la URL configurada sea localhost', () => {
    expect(
      resolveMagicLinkRedirectUrl({
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
        VERCEL_BRANCH_URL:
          'campernova-crm-git-cod-d42ee6-growthaiconsultant-8035s-projects.vercel.app',
        VERCEL_ENV: 'preview',
      })
    ).toBe(
      'https://campernova-crm-git-cod-d42ee6-growthaiconsultant-8035s-projects.vercel.app/auth/callback'
    )
  })

  it('mantiene la URL canónica en producción', () => {
    expect(
      resolveMagicLinkRedirectUrl({
        NEXT_PUBLIC_APP_URL: 'https://crm.campersnova.com/',
        VERCEL_BRANCH_URL: 'campernova-crm-git-main-example.vercel.app',
        VERCEL_ENV: 'production',
      })
    ).toBe('https://crm.campersnova.com/auth/callback')
  })

  it('rechaza un VERCEL_URL que no sea un host de despliegue', () => {
    expect(
      resolveMagicLinkRedirectUrl({
        NEXT_PUBLIC_APP_URL: 'https://crm.example.com',
        VERCEL_BRANCH_URL: 'evil.example.com/path',
        VERCEL_ENV: 'preview',
      })
    ).toBe('https://crm.example.com/auth/callback')
  })

  it('usa localhost como fallback de desarrollo ante una URL configurada inválida', () => {
    expect(resolveMagicLinkRedirectUrl({ NEXT_PUBLIC_APP_URL: 'not-a-url' })).toBe(
      'http://localhost:3000/auth/callback'
    )
  })
})
