import { describe, expect, it } from 'vitest'
import { resolveHostRedirect } from './host-routing'

const CRM = 'crm.campersnova.com'
const APEX = 'campersnova.com'
const base = { crmHost: CRM, apexHost: APEX }

describe('resolveHostRedirect', () => {
  it('apex + ruta de backoffice → CRM (preserva query)', () => {
    expect(resolveHostRedirect({ ...base, host: APEX, pathname: '/dashboard', search: '' })).toBe(
      `https://${CRM}/dashboard`
    )
    expect(
      resolveHostRedirect({ ...base, host: APEX, pathname: '/vendedores/abc', search: '?tab=x' })
    ).toBe(`https://${CRM}/vendedores/abc?tab=x`)
  })

  it('apex + /login y /auth/callback → CRM (preserva code)', () => {
    expect(resolveHostRedirect({ ...base, host: APEX, pathname: '/login' })).toBe(
      `https://${CRM}/login`
    )
    expect(
      resolveHostRedirect({ ...base, host: APEX, pathname: '/auth/callback', search: '?code=1' })
    ).toBe(`https://${CRM}/auth/callback?code=1`)
  })

  it('apex + página pública → null (se queda en el apex)', () => {
    expect(resolveHostRedirect({ ...base, host: APEX, pathname: '/' })).toBeNull()
    expect(resolveHostRedirect({ ...base, host: APEX, pathname: '/comprar' })).toBeNull()
    expect(resolveHostRedirect({ ...base, host: APEX, pathname: '/vender' })).toBeNull()
  })

  it('apex + APIs públicas → null (nunca se mueven)', () => {
    expect(resolveHostRedirect({ ...base, host: APEX, pathname: '/api/chat/buyer' })).toBeNull()
    expect(resolveHostRedirect({ ...base, host: APEX, pathname: '/api/valuation' })).toBeNull()
    expect(
      resolveHostRedirect({ ...base, host: APEX, pathname: '/api/analytics/x.csv' })
    ).toBeNull()
  })

  it('CRM + raíz → /dashboard (mismo host)', () => {
    expect(resolveHostRedirect({ ...base, host: CRM, pathname: '/' })).toBe(
      `https://${CRM}/dashboard`
    )
  })

  it('CRM + marketing público → apex', () => {
    expect(resolveHostRedirect({ ...base, host: CRM, pathname: '/comprar/campers' })).toBe(
      `https://${APEX}/comprar/campers`
    )
    expect(resolveHostRedirect({ ...base, host: CRM, pathname: '/contacto' })).toBe(
      `https://${APEX}/contacto`
    )
  })

  it('CRM + backoffice/login/api → null (se queda en el CRM)', () => {
    expect(resolveHostRedirect({ ...base, host: CRM, pathname: '/dashboard' })).toBeNull()
    expect(resolveHostRedirect({ ...base, host: CRM, pathname: '/login' })).toBeNull()
    expect(resolveHostRedirect({ ...base, host: CRM, pathname: '/auth/callback' })).toBeNull()
    expect(resolveHostRedirect({ ...base, host: CRM, pathname: '/api/analytics/x' })).toBeNull()
  })

  it('sin CRM_HOST → null (feature apagada)', () => {
    expect(
      resolveHostRedirect({ host: APEX, pathname: '/dashboard', apexHost: APEX, crmHost: '' })
    ).toBeNull()
  })

  it('dev / preview → null', () => {
    expect(resolveHostRedirect({ ...base, host: 'localhost', pathname: '/dashboard' })).toBeNull()
    expect(
      resolveHostRedirect({
        ...base,
        host: 'campernova-crm-abc.vercel.app',
        pathname: '/dashboard',
      })
    ).toBeNull()
  })

  it('ignora el puerto en el host', () => {
    expect(resolveHostRedirect({ ...base, host: `${APEX}:443`, pathname: '/dashboard' })).toBe(
      `https://${CRM}/dashboard`
    )
  })
})
