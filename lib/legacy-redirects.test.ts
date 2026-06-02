import { describe, it, expect } from 'vitest'
import { resolveLegacyRedirect } from './legacy-redirects'

describe('resolveLegacyRedirect', () => {
  it('mapea rutas exactas que cambian de slug', () => {
    expect(resolveLegacyRedirect('/tasacion')).toBe('/vender')
    expect(resolveLegacyRedirect('/gestion-de-venta')).toBe('/vender')
    expect(resolveLegacyRedirect('/cars')).toBe('/comprar')
    expect(resolveLegacyRedirect('/carrito')).toBe('/comprar')
    expect(resolveLegacyRedirect('/politica-de-cookies')).toBe('/cookies')
    expect(resolveLegacyRedirect('/privacy-policy')).toBe('/privacidad')
  })

  it('normaliza el trailing slash del WordPress', () => {
    expect(resolveLegacyRedirect('/tasacion/')).toBe('/vender')
    expect(resolveLegacyRedirect('/cars/')).toBe('/comprar')
  })

  it('manda los subárboles de listings/producto al catálogo', () => {
    expect(resolveLegacyRedirect('/listings/volkswagen-california-beach-2023')).toBe('/comprar')
    expect(resolveLegacyRedirect('/listings/')).toBe('/comprar')
    expect(resolveLegacyRedirect('/listings')).toBe('/comprar')
    expect(resolveLegacyRedirect('/producto/business')).toBe('/comprar')
    expect(resolveLegacyRedirect('/categoria-producto/uncategorized')).toBe('/comprar')
  })

  it('devuelve null para rutas que no son legacy', () => {
    expect(resolveLegacyRedirect('/')).toBeNull()
    expect(resolveLegacyRedirect('/comprar')).toBeNull()
    expect(resolveLegacyRedirect('/vendedores')).toBeNull()
    expect(resolveLegacyRedirect('/contacto')).toBeNull()
    // No debe colisionar con un prefijo parecido pero distinto
    expect(resolveLegacyRedirect('/listings-de-algo-distinto')).toBeNull()
  })
})
