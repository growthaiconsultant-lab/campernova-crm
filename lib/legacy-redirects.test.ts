import { describe, it, expect } from 'vitest'
import { resolveLegacyRedirect, isLegacyGone } from './legacy-redirects'

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

  it('NO redirige lo que no tiene valor SEO (se gestiona como 410 Gone)', () => {
    expect(resolveLegacyRedirect('/carrito')).toBeNull() // carrito WooCommerce
    expect(resolveLegacyRedirect('/producto/business')).toBeNull() // producto demo
    expect(resolveLegacyRedirect('/categoria-producto/uncategorized')).toBeNull()
  })

  it('marca como 410 Gone el contenido demo/carrito sin valor SEO', () => {
    expect(isLegacyGone('/carrito')).toBe(true)
    expect(isLegacyGone('/carrito/')).toBe(true)
    expect(isLegacyGone('/producto/business')).toBe(true)
    expect(isLegacyGone('/categoria-producto/uncategorized')).toBe(true)
    // Lo que sí tiene valor o no es legacy NO es Gone
    expect(isLegacyGone('/tasacion')).toBe(false)
    expect(isLegacyGone('/listings/algo')).toBe(false)
    expect(isLegacyGone('/comprar')).toBe(false)
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
