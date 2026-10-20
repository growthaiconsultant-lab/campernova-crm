import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { BuyerStatusSelect } from './buyer-status-select'
import { BuyerListFilters } from './buyer-list-filters'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('status=BAJO_PEDIDO'),
}))
vi.mock('./status-actions', () => ({ setBuyerStatus: vi.fn() }))

describe('COM-8 estado visible en listado y filtros', () => {
  it('ofrece Bajo pedido y lo muestra seleccionado al cargar una ficha con ese estado', () => {
    const html = renderToStaticMarkup(
      createElement(BuyerStatusSelect, {
        leadId: 'test-buyer',
        buyerName: 'Comprador de prueba',
        status: 'BAJO_PEDIDO',
      })
    )
    expect(html).toContain('<option value="BAJO_PEDIDO" selected="">Bajo pedido</option>')
    expect(html).toContain('<option value="CONTACTADO">Contactado</option>')
  })

  it('ofrece Bajo pedido desde Nuevo', () => {
    const html = renderToStaticMarkup(
      createElement(BuyerStatusSelect, {
        leadId: 'test-buyer',
        buyerName: 'Comprador de prueba',
        status: 'NUEVO',
      })
    )
    expect(html).toContain('<option value="BAJO_PEDIDO">Bajo pedido</option>')
  })

  it('reconoce el filtro desde la URL y muestra su etiqueta', () => {
    const html = renderToStaticMarkup(createElement(BuyerListFilters, { agents: [] }))
    expect(html).toContain('<option value="BAJO_PEDIDO" selected="">Bajo pedido</option>')
    expect(html).toContain('Bajo pedido')
  })
})
