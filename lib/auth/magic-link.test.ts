import { describe, expect, it } from 'vitest'
import {
  GENERIC_MAGIC_LINK_ERROR,
  RATE_LIMIT_MAGIC_LINK_ERROR,
  magicLinkErrorMessage,
} from './magic-link-messages'
import { MagicLinkConfigurationError, resolveMagicLinkRedirectUrl } from './magic-link-redirect'

describe('resolveMagicLinkRedirectUrl', () => {
  it('usa el alias estable de la rama en Preview', () => {
    expect(
      resolveMagicLinkRedirectUrl({
        NEXT_PUBLIC_APP_URL: 'https://campersnova.com',
        NODE_ENV: 'production',
        VERCEL_BRANCH_URL: 'campernova-crm-git-cod-auth-example.vercel.app',
        VERCEL_ENV: 'preview',
      })
    ).toBe('https://campernova-crm-git-cod-auth-example.vercel.app/auth/callback')
  })

  it('mantiene la URL canónica configurada en producción', () => {
    expect(
      resolveMagicLinkRedirectUrl({
        NEXT_PUBLIC_APP_URL: 'https://campersnova.com/backoffice',
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      })
    ).toBe('https://campersnova.com/auth/callback')
  })

  it('usa localhost únicamente fuera de producción', () => {
    expect(resolveMagicLinkRedirectUrl({ NODE_ENV: 'test' })).toBe(
      'http://localhost:3000/auth/callback'
    )
  })

  it.each([
    undefined,
    '',
    'evil.example.com',
    'evil.example.com/path',
    'branch.vercel.app.evil.example.com',
  ])('falla de forma cerrada con un alias Preview inválido: %s', (branchUrl) => {
    expect(() =>
      resolveMagicLinkRedirectUrl({
        NEXT_PUBLIC_APP_URL: 'https://campersnova.com',
        NODE_ENV: 'production',
        VERCEL_BRANCH_URL: branchUrl,
        VERCEL_ENV: 'preview',
      })
    ).toThrow(MagicLinkConfigurationError)
  })

  it.each([
    undefined,
    'not-a-url',
    'ftp://campersnova.com',
    'https://user:password@campersnova.com',
  ])('falla de forma cerrada con una URL de producción inválida: %s', (appUrl) => {
    expect(() =>
      resolveMagicLinkRedirectUrl({
        NEXT_PUBLIC_APP_URL: appUrl,
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      })
    ).toThrow(MagicLinkConfigurationError)
  })
})

describe('magicLinkErrorMessage', () => {
  it('explica el límite por código del proveedor', () => {
    expect(magicLinkErrorMessage({ code: 'over_email_send_rate_limit' })).toBe(
      RATE_LIMIT_MAGIC_LINK_ERROR
    )
  })

  it('explica el límite por status HTTP', () => {
    expect(magicLinkErrorMessage({ status: 429 })).toBe(RATE_LIMIT_MAGIC_LINK_ERROR)
  })

  it('no expone detalles de errores desconocidos', () => {
    expect(magicLinkErrorMessage(new Error('user@example.com failed'))).toBe(
      GENERIC_MAGIC_LINK_ERROR
    )
  })
})
