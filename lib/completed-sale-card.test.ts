import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CompletedSaleCard } from '@/components/completed-sale-card'
import type { CompletedSale } from './completed-sales'

const sale: CompletedSale = {
  id: 'delivery-qa',
  completedAt: new Date('2026-10-07T23:30:00Z'),
  buyerLead: { id: 'buyer-qa', name: 'Comprador de prueba' },
  vehicle: {
    id: 'vehicle-qa',
    brand: 'Citroen',
    model: 'Jumpy',
    year: 2020,
    plate: 'QA1234',
    sellerLead: { id: 'seller-qa', name: 'Vendedor de prueba' },
  },
}
const render = (sales: CompletedSale[], side: 'buyer' | 'seller') =>
  renderToStaticMarkup(createElement(CompletedSaleCard, { sales, side }))

describe('resumen histórico de venta en fichas', () => {
  it('muestra vehículo, matrícula, fecha Madrid y enlaces al vendedor y la entrega', () => {
    const html = render([sale], 'buyer')
    expect(html).toContain('Vehículo comprado')
    expect(html).toContain('Citroen Jumpy (2020)')
    expect(html).not.toContain('(2020) (2020)')
    expect(html).toContain('QA1234')
    expect(html).toContain('8/10/2026')
    expect(html).toContain('href="/vendedores/seller-qa"')
    expect(html).toContain('href="/entregas/delivery-qa"')
    expect(html).toContain('Vendedor de prueba')
  })
  it('muestra comprador final con enlace a su ficha desde vendedor', () => {
    const html = render([sale], 'seller')
    expect(html).toContain('Comprador final')
    expect(html).toContain('Comprador de prueba')
    expect(html).toContain('href="/compradores/buyer-qa"')
  })
  it.each(['buyer', 'seller'] as const)(
    'explica ausencia sin fabricar una relación en %s',
    (side) => {
      const html = render([], side)
      expect(html).toContain('No hay ninguna venta completada asociada.')
      expect(html).not.toContain('href=')
    }
  )
  it('conserva históricos con campos incompletos y escapa nombres', () => {
    const missing = {
      ...sale,
      completedAt: null,
      buyerLead: { id: 'buyer-qa', name: '<script>test</script>' },
      vehicle: { ...sale.vehicle, plate: null, brand: null, model: null, year: null },
    }
    const html = render([missing], 'seller')
    expect(html).toContain('Vehículo sin identificar')
    expect(html.match(/Sin registrar/g)).toHaveLength(2)
    expect(html).toContain('&lt;script&gt;test&lt;/script&gt;')
    expect(html).not.toContain('<script>')
  })
  it('lista todas las compras sin perder sus destinos', () => {
    const second = {
      ...sale,
      id: 'delivery-two',
      vehicle: { ...sale.vehicle, sellerLead: { id: 'seller-two', name: 'Otro vendedor' } },
    }
    const html = render([sale, second], 'buyer')
    expect(html).toContain('Vehículos comprados')
    expect(html).toContain('href="/vendedores/seller-two"')
    expect(html).toContain('href="/entregas/delivery-two"')
    expect(html).toContain('href="/entregas/delivery-qa"')
  })
})
