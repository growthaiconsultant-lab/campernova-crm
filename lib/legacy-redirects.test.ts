import { describe, it, expect } from 'vitest'
import { resolveLegacyRedirect } from './legacy-redirects'

describe('resolveLegacyRedirect', () => {
  it('mapea las páginas con valor SEO que cambian de slug', () => {
    expect(resolveLegacyRedirect('/tasacion')).toBe('/vender')
    expect(resolveLegacyRedirect('/gestion-de-venta')).toBe('/vender')
    expect(resolveLegacyRedirect('/cars')).toBe('/comprar')
    expect(resolveLegacyRedirect('/politica-de-cookies')).toBe('/cookies')
    expect(resolveLegacyRedirect('/privacy-policy')).toBe('/privacidad')
  })

  it('normaliza el trailing slash del WordPress', () => {
    expect(resolveLegacyRedirect('/tasacion/')).toBe('/vender')
    expect(resolveLegacyRedirect('/cars/')).toBe('/comprar')
  })

  it('manda las fichas de vehículo (/listings/*) al catálogo', () => {
    expect(resolveLegacyRedirect('/listings/volkswagen-california-beach-2023')).toBe('/comprar')
    expect(resolveLegacyRedirect('/listings/')).toBe('/comprar')
    expect(resolveLegacyRedirect('/listings')).toBe('/comprar')
  })

  it('NO redirige lo que no tiene valor SEO (404 intencionado)', () => {
    expect(resolveLegacyRedirect('/carrito')).toBeNull() // carrito WooCommerce
    expect(resolveLegacyRedirect('/producto/business')).toBeNull() // producto demo
    expect(resolveLegacyRedirect('/categoria-producto/uncategorized')).toBeNull()
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
